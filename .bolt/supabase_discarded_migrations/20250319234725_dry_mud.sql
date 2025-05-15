/*
  # Delete user with reference cleanup

  1. Changes
    - Update references to NULL in clients table
    - Update references to NULL in other tables
    - Delete user from auth.users
    
  2. Security
    - Only run as superuser/admin
    - Ensure proper cleanup of related data
*/

DO $$
BEGIN
  -- Update references in clients table
  UPDATE clients 
  SET created_by = NULL,
      updated_by = NULL
  WHERE created_by = '09a031ac-4c21-4bfb-9405-c0111d5e3b7b'
     OR updated_by = '09a031ac-4c21-4bfb-9405-c0111d5e3b7b';

  -- Update references in projects table
  UPDATE projects
  SET created_by = NULL,
      updated_by = NULL
  WHERE created_by = '09a031ac-4c21-4bfb-9405-c0111d5e3b7b'
     OR updated_by = '09a031ac-4c21-4bfb-9405-c0111d5e3b7b';

  -- Update references in reservations table
  UPDATE reservations
  SET created_by = NULL,
      updated_by = NULL,
      seller_id = NULL
  WHERE created_by = '09a031ac-4c21-4bfb-9405-c0111d5e3b7b'
     OR updated_by = '09a031ac-4c21-4bfb-9405-c0111d5e3b7b'
     OR seller_id = '09a031ac-4c21-4bfb-9405-c0111d5e3b7b';

  -- Delete from auth.users which will cascade to profiles and other related tables
  DELETE FROM auth.users 
  WHERE id = '09a031ac-4c21-4bfb-9405-c0111d5e3b7b';
END $$;