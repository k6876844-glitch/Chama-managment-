<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContributionController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\FineController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\MeetingController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

// All routes and the roles allowed on each are listed here, so the access
// rules can be read in one place (see docs/api.md at the project root).

$officials = 'role:chairperson,treasurer,secretary';
$chairOrSecretary = 'role:chairperson,secretary';

Route::post('auth/login', [AuthController::class, 'login']);
Route::post('auth/register', [AuthController::class, 'register']); // self sign-up, always as an ordinary member

Route::middleware('auth:sanctum')->group(function () use ($officials, $chairOrSecretary) {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    Route::get('members', [MemberController::class, 'index'])->middleware($officials);
    Route::get('members/{member}', [MemberController::class, 'show']); // controller allows self
    Route::post('members', [MemberController::class, 'store'])->middleware($chairOrSecretary);
    Route::put('members/{member}', [MemberController::class, 'update'])->middleware($chairOrSecretary);
    Route::delete('members/{member}', [MemberController::class, 'destroy'])->middleware('role:chairperson');

    Route::get('contributions', [ContributionController::class, 'index']);
    Route::post('contributions', [ContributionController::class, 'store'])->middleware('role:treasurer,chairperson');
    Route::put('contributions/{contribution}', [ContributionController::class, 'update'])->middleware('role:treasurer');
    Route::delete('contributions/{contribution}', [ContributionController::class, 'destroy'])->middleware('role:treasurer');

    Route::get('loans', [LoanController::class, 'index']);
    Route::get('loans/{loan}', [LoanController::class, 'show']);
    Route::post('loans', [LoanController::class, 'store']);
    Route::patch('loans/{loan}/approve', [LoanController::class, 'approve'])->middleware('role:chairperson');
    Route::patch('loans/{loan}/reject', [LoanController::class, 'reject'])->middleware('role:chairperson');
    Route::post('loans/{loan}/repayments', [LoanController::class, 'repay'])->middleware('role:treasurer');

    Route::get('fines', [FineController::class, 'index']);
    Route::post('fines', [FineController::class, 'store'])->middleware('role:treasurer,secretary');
    Route::patch('fines/{fine}/pay', [FineController::class, 'pay'])->middleware('role:treasurer');
    Route::patch('fines/{fine}/waive', [FineController::class, 'waive'])->middleware('role:chairperson');

    Route::get('expenses', [ExpenseController::class, 'index']);
    Route::post('expenses', [ExpenseController::class, 'store'])->middleware('role:treasurer');
    Route::put('expenses/{expense}', [ExpenseController::class, 'update'])->middleware('role:treasurer');
    Route::delete('expenses/{expense}', [ExpenseController::class, 'destroy'])->middleware('role:treasurer');

    Route::get('meetings', [MeetingController::class, 'index']);
    Route::get('meetings/{meeting}', [MeetingController::class, 'show']);
    Route::post('meetings', [MeetingController::class, 'store'])->middleware($chairOrSecretary);
    Route::put('meetings/{meeting}', [MeetingController::class, 'update'])->middleware($chairOrSecretary);
    Route::put('meetings/{meeting}/attendance', [MeetingController::class, 'attendance'])->middleware('role:secretary');

    Route::get('reports/summary', [ReportController::class, 'summary'])->middleware($officials);
    Route::get('reports/statement/{member}', [ReportController::class, 'statement']); // controller allows self
});
