/*
  # Add email field to profiles table

  1. Changes
    - Add email column to profiles table
    - Add index on email column
    - Add unique constraint on email
*/

-- Add email column
ALTER TABLE profiles ADD COLUMN email text;

-- Create index for email searches
CREATE INDEX profiles_email_idx ON profiles (email);

-- Add unique constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);