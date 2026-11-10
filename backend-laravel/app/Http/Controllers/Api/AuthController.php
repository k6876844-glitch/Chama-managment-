<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'phone' => 'required|string',
            'password' => 'required|string',
        ]);

        $member = Member::where('phone', $data['phone'])->first();

        if (! $member || ! Hash::check($data['password'], $member->password)) {
            return response()->json(['message' => 'Wrong phone number or password'], 401);
        }
        if ($member->status !== 'active') {
            return response()->json(['message' => 'This account has been deactivated'], 403);
        }

        return response()->json([
            'token' => $member->createToken('api')->plainTextToken,
            'user' => $member,
        ]);
    }

    // Self sign-up. New accounts are always ordinary members: only the chairperson
    // can give someone an official role later, from the Members page.
    public function register(Request $request)
    {
        $data = $request->validate([
            'full_name' => 'required|string|max:120',
            'phone' => 'required|string|max:20|unique:members,phone',
            'email' => 'nullable|email|max:120|unique:members,email',
            'id_number' => 'nullable|string|max:20',
            'password' => 'required|string|min:6',
        ], [
            'phone.unique' => 'An account with this phone number already exists. Please log in.',
            'email.unique' => 'An account with this email already exists',
        ]);

        $member = Member::create($data + ['role' => 'member', 'joined_at' => now()->toDateString()]);
        $member->update(['member_no' => 'M'.str_pad($member->id, 3, '0', STR_PAD_LEFT)]);

        return response()->json([
            'token' => $member->createToken('api')->plainTextToken,
            'user' => $member->fresh(),
        ], 201);
    }

    public function me(Request $request)
    {
        return $request->user();
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }
}
