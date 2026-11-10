<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Meeting;
use Illuminate\Http\Request;

class MeetingController extends Controller
{
    public function index()
    {
        return Meeting::query()
            ->select('meetings.*')
            ->selectRaw("(SELECT COUNT(*) FROM attendance a WHERE a.meeting_id = meetings.id AND a.status IN ('present', 'late')) AS present_count")
            ->orderByDesc('meeting_date')
            ->orderByDesc('id')
            ->get();
    }

    public function show(Meeting $meeting)
    {
        $meeting->setAttribute('attendance', Attendance::query()
            ->join('members', 'members.id', '=', 'attendance.member_id')
            ->where('attendance.meeting_id', $meeting->id)
            ->orderBy('members.full_name')
            ->get(['attendance.member_id', 'attendance.status', 'members.full_name as member_name']));

        return $meeting;
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $data['created_by'] = $request->user()->id;

        return response()->json(Meeting::create($data)->fresh(), 201);
    }

    public function update(Request $request, Meeting $meeting)
    {
        $meeting->update($request->validate($this->rules(true)));

        return $meeting;
    }

    // Body: { records: [{ member_id, status }] }. Saving again overwrites earlier marks.
    public function attendance(Request $request, Meeting $meeting)
    {
        $data = $request->validate([
            'records' => 'required|array|min:1',
            'records.*.member_id' => 'required|exists:members,id',
            'records.*.status' => 'required|in:present,absent,apology,late',
        ]);

        foreach ($data['records'] as $record) {
            Attendance::updateOrCreate(
                ['meeting_id' => $meeting->id, 'member_id' => $record['member_id']],
                ['status' => $record['status']],
            );
        }

        return $this->show($meeting);
    }

    private function rules(bool $updating = false): array
    {
        $required = $updating ? 'sometimes|required' : 'required';

        return [
            'title' => "$required|string|max:120",
            'meeting_date' => "$required|date",
            'venue' => 'nullable|string|max:120',
            'agenda' => 'nullable|string',
            'minutes' => 'nullable|string',
        ];
    }
}
