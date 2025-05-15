/*
  # Fix avatar storage policies

  1. Changes
    - Drop existing policies
    - Create new policies with proper permissions
    - Add CASCADE to policy drops to avoid dependency issues
    
  2. Security
    - Allow users to manage their own avatars
    - Allow public read access to avatars
*/

-- Drop existing policies with CASCADE
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects CASCADE;

-- Create new policies with proper permissions
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  CASE 
    WHEN POSITION('/' IN name) > 0 THEN
      (auth.uid())::text = SPLIT_PART(name, '/', 1)
    ELSE
      true
  END
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND 
  CASE 
    WHEN POSITION('/' IN name) > 0 THEN
      (auth.uid())::text = SPLIT_PART(name, '/', 1)
    ELSE
      true
  END
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND 
  CASE 
    WHEN POSITION('/' IN name) > 0 THEN
      (auth.uid())::text = SPLIT_PART(name, '/', 1)
    ELSE
      true
  END
);

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Ensure the avatars bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;