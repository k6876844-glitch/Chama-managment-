<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Meeting extends Model
{
    protected $fillable = ['title', 'meeting_date', 'venue', 'agenda', 'minutes', 'created_by'];

    protected function casts(): array
    {
        return [
            'meeting_date' => 'date:Y-m-d',
            'present_count' => 'integer', // added by MeetingController's query
        ];
    }

    public function attendance()
    {
        return $this->hasMany(Attendance::class);
    }
}
