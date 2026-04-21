-- Make transaction_updates.updated_by_user_id nullable to support master acting as clerk
ALTER TABLE "transaction_updates" ALTER COLUMN "updated_by_user_id" DROP NOT NULL;
