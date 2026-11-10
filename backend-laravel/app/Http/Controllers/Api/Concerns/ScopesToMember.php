<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\Request;

trait ScopesToMember
{
    // Ordinary members only ever see their own records; officials may filter by ?member_id.
    protected function scopedMemberId(Request $request): ?int
    {
        $user = $request->user();

        if (! $user->isOfficial()) {
            return $user->id;
        }

        return $request->filled('member_id') ? (int) $request->query('member_id') : null;
    }

    protected function forbidden(string $message)
    {
        return response()->json(['message' => $message], 403);
    }
}
