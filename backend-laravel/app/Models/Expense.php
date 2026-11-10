<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    protected $fillable = ['category', 'description', 'amount', 'expense_date', 'receipt_ref', 'recorded_by'];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'expense_date' => 'date:Y-m-d',
        ];
    }
}
