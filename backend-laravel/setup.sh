#!/usr/bin/env bash
# Builds a full Laravel app around the Chama files in this folder.
# Needs PHP 8.2+ and Composer. Run once from anywhere: bash setup.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ -f artisan ]; then
  echo "Laravel is already set up in this folder."
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

composer create-project laravel/laravel "$tmp/app" "^12.0"
(cd "$tmp/app" && php artisan install:api --without-migration-prompt)

# Copy Laravel's files in without overwriting the Chama files already here.
mv "$tmp/app/vendor" ./vendor
(cd "$tmp/app" && find . -type f) | while IFS= read -r f; do
  if [ ! -e "$f" ]; then
    mkdir -p "$(dirname "$f")"
    cp "$tmp/app/$f" "$f"
  fi
done

cp .env.example .env
php artisan key:generate

echo
echo "Laravel is ready. Next:"
echo "  1. Create an empty MySQL database called 'chama' and check the DB_ settings in .env"
echo "  2. php artisan migrate --seed"
echo "  3. php artisan serve      (API at http://localhost:8000/api)"
