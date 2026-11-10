<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanRepayment extends Model
{
    protected $fillable = ['loan_id', 'amount', 'method', 'reference', 'payment_date', 'recorded_by'];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'payment_date' => 'date:Y-m-d',
        ];
    }

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }
}
