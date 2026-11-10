<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ScopesToMember;
use App\Http\Controllers\Controller;
use App\Models\Loan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoanController extends Controller
{
    use ScopesToMember;

    private function query()
    {
        $paid = '(SELECT COALESCE(SUM(r.amount), 0) FROM loan_repayments r WHERE r.loan_id = loans.id)';

        return Loan::query()
            ->join('members', 'members.id', '=', 'loans.member_id')
            ->select('loans.*', 'members.full_name as member_name')
            ->selectRaw("$paid AS amount_paid")
            ->selectRaw("loans.total_due - $paid AS balance");
    }

    private function find(int $id)
    {
        return $this->query()->where('loans.id', $id)->first();
    }

    public function index(Request $request)
    {
        $query = $this->query()->orderByDesc('applied_at')->orderByDesc('loans.id');

        if ($memberId = $this->scopedMemberId($request)) {
            $query->where('loans.member_id', $memberId);
        }
        if ($request->filled('status')) {
            $query->where('loans.status', $request->query('status'));
        }

        return $query->get();
    }

    public function show(Request $request, Loan $loan)
    {
        $user = $request->user();
        if (! $user->isOfficial() && (int) $loan->member_id !== $user->id) {
            return $this->forbidden('You can only view your own loans');
        }

        $row = $this->find($loan->id);
        $row->setAttribute('repayments', $loan->repayments()->orderBy('payment_date')->orderBy('id')->get());

        return $row;
    }

    // Any member can apply for themselves. Officials can also record a loan for another member.
    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'member_id' => 'nullable|exists:members,id',
            'principal' => 'required|numeric|gt:0',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
            'purpose' => 'nullable|string|max:255',
            'due_date' => 'nullable|date',
        ]);

        $memberId = $user->isOfficial() && ! empty($data['member_id']) ? (int) $data['member_id'] : $user->id;
        $rate = $user->isOfficial() && isset($data['interest_rate'])
            ? (float) $data['interest_rate']
            : (float) (DB::table('settings')->where('name', 'loan_interest_rate')->value('value') ?? 10);

        $loan = Loan::create([
            'member_id' => $memberId,
            'principal' => $data['principal'],
            'interest_rate' => $rate,
            'total_due' => round($data['principal'] * (1 + $rate / 100), 2),
            'purpose' => $data['purpose'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'applied_at' => now()->toDateString(),
            'recorded_by' => $user->id,
        ]);

        return response()->json($this->find($loan->id), 201);
    }

    public function approve(Request $request, Loan $loan)
    {
        if ($loan->status !== 'pending') {
            return response()->json(['message' => 'Only pending loans can be approved'], 409);
        }

        $loan->update([
            'status' => 'active',
            'approved_by' => $request->user()->id,
            'issue_date' => $loan->issue_date ?? now()->toDateString(),
        ]);

        return $this->find($loan->id);
    }

    public function reject(Request $request, Loan $loan)
    {
        if ($loan->status !== 'pending') {
            return response()->json(['message' => 'Only pending loans can be rejected'], 409);
        }

        $loan->update(['status' => 'rejected', 'approved_by' => $request->user()->id]);

        return $this->find($loan->id);
    }

    // Records a repayment and marks the loan cleared once it is fully paid.
    public function repay(Request $request, Loan $loan)
    {
        $data = $request->validate([
            'amount' => 'required|numeric|gt:0',
            'method' => 'nullable|in:mpesa,cash,bank',
            'reference' => 'nullable|string|max:50',
            'payment_date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($request, $loan, $data) {
            $loan = Loan::whereKey($loan->id)->lockForUpdate()->first();

            if ($loan->status !== 'active') {
                return response()->json(['message' => 'Repayments can only be recorded on active loans'], 409);
            }

            $balance = $loan->total_due - (float) $loan->repayments()->sum('amount');
            if ($data['amount'] > $balance + 0.001) {
                return response()->json([
                    'message' => 'Amount is more than the loan balance of KES '.number_format($balance, 2),
                ], 422);
            }

            $loan->repayments()->create([
                'amount' => $data['amount'],
                'method' => $data['method'] ?? 'mpesa',
                'reference' => $data['reference'] ?? null,
                'payment_date' => $data['payment_date'] ?? now()->toDateString(),
                'recorded_by' => $request->user()->id,
            ]);

            if ($data['amount'] >= $balance - 0.001) {
                $loan->update(['status' => 'cleared']);
            }

            return response()->json($this->find($loan->id), 201);
        });
    }
}
