<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Flat interest: total_due = principal * (1 + interest_rate / 100).
class Loan extends Model
{
    protected $fillable = [
        'member_id', 'principal', 'interest_rate', 'total_due', 'purpose', 'status',
        'applied_at', 'issue_date', 'due_date', 'approved_by', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'principal' => 'float',
            'interest_rate' => 'float',
            'total_due' => 'float',
            'amount_paid' => 'float', // added by LoanController's query
            'balance' => 'float',     // added by LoanController's query
            'applied_at' => 'date:Y-m-d',
            'issue_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
        ];
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    public function repayments()
    {
        return $this->hasMany(LoanRepayment::class);
    }
}
