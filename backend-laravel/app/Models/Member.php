<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

// Members are the users of the system. The role column drives access control.
class Member extends Authenticatable
{
    use HasApiTokens;

    public const ROLES = ['chairperson', 'treasurer', 'secretary', 'member'];

    public const OFFICIALS = ['chairperson', 'treasurer', 'secretary'];

    protected $fillable = [
        'member_no', 'full_name', 'phone', 'email', 'id_number', 'role', 'password', 'status', 'joined_at',
    ];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'joined_at' => 'date:Y-m-d',
        ];
    }

    public function isOfficial(): bool
    {
        return in_array($this->role, self::OFFICIALS, true);
    }

    public function contributions()
    {
        return $this->hasMany(Contribution::class);
    }

    public function loans()
    {
        return $this->hasMany(Loan::class);
    }

    public function fines()
    {
        return $this->hasMany(Fine::class);
    }

    public function attendance()
    {
        return $this->hasMany(Attendance::class);
    }
}
