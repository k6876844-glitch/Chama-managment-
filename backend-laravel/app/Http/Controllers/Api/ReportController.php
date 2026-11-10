<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ScopesToMember;
use App\Http\Controllers\Controller;
use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    use ScopesToMember;

    // Group-wide financial summary for officials.
    public function summary()
    {
        $t = (array) DB::selectOne("SELECT
            (SELECT COALESCE(SUM(amount), 0) FROM contributions) AS total_contributions,
            (SELECT COALESCE(SUM(amount), 0) FROM loan_repayments) AS total_repayments,
            (SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'paid') AS total_fines_paid,
            (SELECT COALESCE(SUM(amount), 0) FROM expenses) AS total_expenses,
            (SELECT COALESCE(SUM(principal), 0) FROM loans WHERE status IN ('active', 'cleared', 'defaulted')) AS total_loans_issued,
            (SELECT COALESCE(SUM(l.total_due - (SELECT COALESCE(SUM(r.amount), 0) FROM loan_repayments r WHERE r.loan_id = l.id)), 0)
               FROM loans l WHERE l.status IN ('active', 'defaulted')) AS loans_outstanding,
            (SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'unpaid') AS fines_unpaid,
            (SELECT COUNT(*) FROM members WHERE status = 'active') AS active_members");

        $t = array_map('floatval', $t);
        $t['active_members'] = (int) $t['active_members'];
        $t['total_income'] = $t['total_contributions'] + $t['total_repayments'] + $t['total_fines_paid'];
        $t['cash_at_hand'] = $t['total_income'] - $t['total_loans_issued'] - $t['total_expenses'];

        return $t;
    }

    // One member's contributions, loans, fines and attendance.
    public function statement(Request $request, Member $member)
    {
        $user = $request->user();
        if (! $user->isOfficial() && $user->id !== $member->id) {
            return $this->forbidden('You can only view your own statement');
        }

        $contributions = $member->contributions()->orderByDesc('contribution_date')->orderByDesc('id')->get();
        $fines = $member->fines()->orderByDesc('fine_date')->orderByDesc('id')->get();
        $loans = $member->loans()
            ->select('loans.*')
            ->selectRaw('(SELECT COALESCE(SUM(r.amount), 0) FROM loan_repayments r WHERE r.loan_id = loans.id) AS amount_paid')
            ->orderByDesc('applied_at')
            ->orderByDesc('id')
            ->get()
            ->each(fn ($loan) => $loan->setAttribute('balance', $loan->total_due - $loan->amount_paid));

        $attendance = $member->attendance()->get();

        return [
            'member' => $member,
            'contributions' => $contributions,
            'loans' => $loans,
            'fines' => $fines,
            'attendance' => [
                'total' => $attendance->count(),
                'present' => $attendance->whereIn('status', ['present', 'late'])->count(),
            ],
            'totals' => [
                'contributions' => (float) $contributions->sum('amount'),
                'loan_balance' => (float) $loans->whereIn('status', ['active', 'defaulted'])->sum('balance'),
                'fines_unpaid' => (float) $fines->where('status', 'unpaid')->sum('amount'),
            ],
        ];
    }
}
