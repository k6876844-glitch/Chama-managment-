<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ScopesToMember;
use App\Http\Controllers\Controller;
use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MemberController extends Controller
{
    use ScopesToMember;

    public function index()
    {
        return Member::orderBy('full_name')->get();
    }

    public function show(Request $request, Member $member)
    {
        $user = $request->user();
        if (! $user->isOfficial() && $user->id !== $member->id) {
            return $this->forbidden('You can only view your own profile');
        }

        return $member;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'full_name' => 'required|string|max:120',
            'phone' => 'required|string|max:20|unique:members,phone',
            'email' => 'nullable|email|max:120|unique:members,email',
            'id_number' => 'nullable|string|max:20',
            'role' => ['nullable', Rule::in(Member::ROLES)],
            'joined_at' => 'nullable|date',
            'password' => 'required|string|min:6',
        ]);

        $data['role'] ??= 'member';
        if ($data['role'] !== 'member' && $request->user()->role !== 'chairperson') {
            return $this->forbidden('Only the chairperson can assign official roles');
        }
        $data['joined_at'] ??= now()->toDateString();

        $member = Member::create($data);
        $member->update(['member_no' => 'M'.str_pad($member->id, 3, '0', STR_PAD_LEFT)]);

        return response()->json($member, 201);
    }

    public function update(Request $request, Member $member)
    {
        $data = $request->validate([
            'full_name' => 'sometimes|required|string|max:120',
            'phone' => ['sometimes', 'required', 'string', 'max:20', Rule::unique('members', 'phone')->ignore($member->id)],
            'email' => ['nullable', 'email', 'max:120', Rule::unique('members', 'email')->ignore($member->id)],
            'id_number' => 'nullable|string|max:20',
            'role' => ['sometimes', Rule::in(Member::ROLES)],
            'status' => 'sometimes|in:active,inactive',
            'joined_at' => 'sometimes|date',
            'password' => 'nullable|string|min:6',
        ]);

        if (isset($data['role']) && $data['role'] !== $member->role && $request->user()->role !== 'chairperson') {
            return $this->forbidden('Only the chairperson can change roles');
        }
        if (empty($data['password'])) {
            unset($data['password']);
        }

        $member->update($data);

        return $member;
    }

    // Members are never deleted, so their financial history stays intact.
    public function destroy(Request $request, Member $member)
    {
        if ($member->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot deactivate your own account'], 422);
        }

        $member->update(['status' => 'inactive']);

        return $member;
    }
}
