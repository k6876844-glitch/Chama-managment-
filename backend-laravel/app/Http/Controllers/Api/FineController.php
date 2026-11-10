<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ScopesToMember;
use App\Http\Controllers\Controller;
use App\Models\Fine;
use Illuminate\Http\Request;

class FineController extends Controller
{
    use ScopesToMember;

    private function query()
    {
        return Fine::query()
            ->join('members', 'members.id', '=', 'fines.member_id')
            ->select('fines.*', 'members.full_name as member_name');
    }

    private function find(int $id)
    {
        return $this->query()->where('fines.id', $id)->first();
    }

    public function index(Request $request)
    {
        $query = $this->query()->orderByDesc('fine_date')->orderByDesc('fines.id');

        if ($memberId = $this->scopedMemberId($request)) {
            $query->where('fines.member_id', $memberId);
        }
        if ($request->filled('status')) {
            $query->where('fines.status', $request->query('status'));
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'member_id' => 'required|exists:members,id',
            'reason' => 'required|string|max:255',
            'amount' => 'required|numeric|gt:0',
            'fine_date' => 'nullable|date',
        ]);
        $data['fine_date'] ??= now()->toDateString();
        $data['recorded_by'] = $request->user()->id;

        $fine = Fine::create($data);

        return response()->json($this->find($fine->id), 201);
    }

    public function pay(Fine $fine)
    {
        if ($fine->status !== 'unpaid') {
            return response()->json(['message' => 'Only unpaid fines can be marked as paid'], 409);
        }

        $fine->update(['status' => 'paid', 'paid_date' => now()->toDateString()]);

        return $this->find($fine->id);
    }

    public function waive(Fine $fine)
    {
        if ($fine->status !== 'unpaid') {
            return response()->json(['message' => 'Only unpaid fines can be waived'], 409);
        }

        $fine->update(['status' => 'waived']);

        return $this->find($fine->id);
    }
}
