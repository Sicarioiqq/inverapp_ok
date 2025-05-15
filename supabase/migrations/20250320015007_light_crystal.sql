/*
  # Allow administrators to manage all user avatars

  1. Changes
    - Update storage policies to allow admin access
    - Add policies for admin avatar management
    - Maintain existing user policies
*/

-- Drop existing policies with CASCADE
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects CASCADE;

-- Create new policies with admin permissions
CREATE POLICY "Admins and users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND (
    -- User can upload their own avatar
    CASE 
      WHEN POSITION('/' IN name) > 0 THEN
        (auth.uid())::text = SPLIT_PART(name, '/', 1)
      ELSE false
    END
    OR
    -- Admin can upload any avatar
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'Administrador'
    )
  )
);

CREATE POLICY "Admins and users can update avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND (
    -- User can update their own avatar
    CASE 
      WHEN POSITION('/' IN name) > 0 THEN
        (auth.uid())::text = SPLIT_PART(name, '/', 1)
      ELSE false
    END
    OR
    -- Admin can update any avatar
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'Administrador'
    )
  )
);

CREATE POLICY "Admins and users can delete avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND (
    -- User can delete their own avatar
    CASE 
      WHEN POSITION('/' IN name) > 0 THEN
        (auth.uid())::text = SPLIT_PART(name, '/', 1)
      ELSE false
    END
    OR
    -- Admin can delete any avatar
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'Administrador'
    )
  )
);

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');