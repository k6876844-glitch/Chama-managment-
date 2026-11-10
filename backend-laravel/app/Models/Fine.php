<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Fine extends Model
{
    protected $fillable = ['member_id', 'reason', 'amount', 'fine_date', 'status', 'paid_date', 'recorded_by'];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'fine_date' => 'date:Y-m-d',
            'paid_date' => 'date:Y-m-d',
        ];
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }
}
