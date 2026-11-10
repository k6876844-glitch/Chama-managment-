<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $query = Expense::orderByDesc('expense_date')->orderByDesc('id');

        if ($request->filled('from')) {
            $query->where('expense_date', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('expense_date', '<=', $request->query('to'));
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $data['expense_date'] ??= now()->toDateString();
        $data['recorded_by'] = $request->user()->id;

        return response()->json(Expense::create($data)->fresh(), 201);
    }

    public function update(Request $request, Expense $expense)
    {
        $expense->update($request->validate($this->rules(true)));

        return $expense;
    }

    public function destroy(Expense $expense)
    {
        $expense->delete();

        return response()->noContent();
    }

    private function rules(bool $updating = false): array
    {
        $required = $updating ? 'sometimes|required' : 'required';

        return [
            'category' => "$required|string|max:60",
            'description' => 'nullable|string|max:255',
            'amount' => "$required|numeric|gt:0",
            'expense_date' => 'nullable|date',
            'receipt_ref' => 'nullable|string|max:50',
        ];
    }
}
