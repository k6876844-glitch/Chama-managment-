<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Contribution extends Model
{
    protected $fillable = [
        'member_id', 'amount', 'method', 'reference', 'contribution_date', 'notes', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'contribution_date' => 'date:Y-m-d',
        ];
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }
}
