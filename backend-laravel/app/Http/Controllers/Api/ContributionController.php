<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ScopesToMember;
use App\Http\Controllers\Controller;
use App\Models\Contribution;
use Illuminate\Http\Request;

class ContributionController extends Controller
{
    use ScopesToMember;

    private function query()
    {
        return Contribution::query()
            ->join('members', 'members.id', '=', 'contributions.member_id')
            ->select('contributions.*', 'members.full_name as member_name');
    }

    private function find(int $id)
    {
        return $this->query()->where('contributions.id', $id)->first();
    }

    public function index(Request $request)
    {
        $query = $this->query()->orderByDesc('contribution_date')->orderByDesc('contributions.id');

        if ($memberId = $this->scopedMemberId($request)) {
            $query->where('contributions.member_id', $memberId);
        }
        if ($request->filled('from')) {
            $query->where('contribution_date', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('contribution_date', '<=', $request->query('to'));
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $data['method'] ??= 'mpesa';
        $data['contribution_date'] ??= now()->toDateString();
        $data['recorded_by'] = $request->user()->id;

        $contribution = Contribution::create($data);

        return response()->json($this->find($contribution->id), 201);
    }

    public function update(Request $request, Contribution $contribution)
    {
        $contribution->update($request->validate($this->rules(true)));

        return $this->find($contribution->id);
    }

    public function destroy(Contribution $contribution)
    {
        $contribution->delete();

        return response()->noContent();
    }

    private function rules(bool $updating = false): array
    {
        $required = $updating ? 'sometimes|required' : 'required';

        return [
            'member_id' => "$required|exists:members,id",
            'amount' => "$required|numeric|gt:0",
            'method' => 'nullable|in:mpesa,cash,bank',
            'reference' => 'nullable|string|max:50',
            'contribution_date' => 'nullable|date',
            'notes' => 'nullable|string|max:255',
        ];
    }
}
