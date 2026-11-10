<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Creates every Chama table. Mirrors database/schema.sql at the project root.
return new class extends Migration
{
    public function up(): void
    {
        // Members are also the system's users; role drives role-based access control.
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->string('member_no', 20)->nullable()->unique();
            $table->string('full_name', 120);
            $table->string('phone', 20)->unique();
            $table->string('email', 120)->nullable()->unique();
            $table->string('id_number', 20)->nullable();
            $table->enum('role', ['chairperson', 'treasurer', 'secretary', 'member'])->default('member');
            $table->string('password');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->date('joined_at');
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('name', 60)->primary();
            $table->string('value');
        });

        DB::table('settings')->insert([
            ['name' => 'chama_name', 'value' => 'Umoja Chama'],
            ['name' => 'contribution_amount', 'value' => '1000'],
            ['name' => 'loan_interest_rate', 'value' => '10'],
        ]);

        Schema::create('contributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members');
            $table->decimal('amount', 12, 2);
            $table->enum('method', ['mpesa', 'cash', 'bank'])->default('mpesa');
            $table->string('reference', 50)->nullable();
            $table->date('contribution_date');
            $table->string('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('members')->nullOnDelete();
            $table->timestamps();
        });

        // Flat interest: total_due = principal * (1 + interest_rate / 100).
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members');
            $table->decimal('principal', 12, 2);
            $table->decimal('interest_rate', 5, 2);
            $table->decimal('total_due', 12, 2);
            $table->string('purpose')->nullable();
            $table->enum('status', ['pending', 'active', 'cleared', 'rejected', 'defaulted'])->default('pending');
            $table->date('applied_at');
            $table->date('issue_date')->nullable();
            $table->date('due_date')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('members')->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('members')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('loan_repayments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained('loans')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->enum('method', ['mpesa', 'cash', 'bank'])->default('mpesa');
            $table->string('reference', 50)->nullable();
            $table->date('payment_date');
            $table->foreignId('recorded_by')->nullable()->constrained('members')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('fines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members');
            $table->string('reason');
            $table->decimal('amount', 12, 2);
            $table->date('fine_date');
            $table->enum('status', ['unpaid', 'paid', 'waived'])->default('unpaid');
            $table->date('paid_date')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('members')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->string('category', 60);
            $table->string('description')->nullable();
            $table->decimal('amount', 12, 2);
            $table->date('expense_date');
            $table->string('receipt_ref', 50)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('members')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('meetings', function (Blueprint $table) {
            $table->id();
            $table->string('title', 120);
            $table->date('meeting_date');
            $table->string('venue', 120)->nullable();
            $table->text('agenda')->nullable();
            $table->text('minutes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('members')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('attendance', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained('meetings')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members');
            $table->enum('status', ['present', 'absent', 'apology', 'late'])->default('present');
            $table->timestamps();
            $table->unique(['meeting_id', 'member_id']);
        });

        // Payment and meeting reminders. member_id null means the whole group.
        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->nullable()->constrained('members')->cascadeOnDelete();
            $table->enum('type', ['payment', 'meeting', 'loan', 'general'])->default('general');
            $table->string('message');
            $table->dateTime('send_at')->nullable();
            $table->dateTime('sent_at')->nullable();
            $table->dateTime('read_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('members')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['reminders', 'attendance', 'meetings', 'expenses', 'fines', 'loan_repayments', 'loans', 'contributions', 'settings', 'members'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
