<?php

namespace Database\Seeders;

use App\Models\Member;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    // Creates the first chairperson (ADMIN_* in .env) so someone can log in and add the other members.
    public function run(): void
    {
        $member = Member::firstOrCreate(
            ['phone' => env('ADMIN_PHONE', '0700000000')],
            [
                'full_name' => env('ADMIN_NAME', 'Chama Chairperson'),
                'role' => 'chairperson',
                'password' => env('ADMIN_PASSWORD', 'changeme123'),
                'joined_at' => now()->toDateString(),
            ],
        );

        if (! $member->member_no) {
            $member->update(['member_no' => 'M'.str_pad($member->id, 3, '0', STR_PAD_LEFT)]);
        }

        $this->command->info("Chairperson created. Log in with phone {$member->phone}.");
    }
}
