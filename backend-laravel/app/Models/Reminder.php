<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Payment and meeting reminders. member_id null means the whole group.
class Reminder extends Model
{
    protected $fillable = ['member_id', 'type', 'message', 'send_at', 'sent_at', 'read_at', 'created_by'];

    protected function casts(): array
    {
        return [
            'send_at' => 'datetime',
            'sent_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }
}
