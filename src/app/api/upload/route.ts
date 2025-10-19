import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!supabaseUrl || !serviceRoleKey) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing Supabase env vars' }),
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'image';
    const userId = (formData.get('userId') as string) || 'anonymous';

    if (!file) {
      return new NextResponse(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400 }
      );
    }
    // Basic validation
    if (!file.type.startsWith('image/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Only image uploads are allowed' }),
        { status: 400 }
      );
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      return new NextResponse(
        JSON.stringify({ error: 'File too large (max 5MB)' }),
        { status: 400 }
      );
    }

    // Use dealer-logos bucket when type is logo
    const bucket = type === 'logo' ? 'dealer-logos' : 'car-images';
    const fileExt = (file.name.split('.').pop() || 'png').toLowerCase();
    
    // For logos, use a consistent filename based on the dealer ID to ensure we can always find it
    const fileName = type === 'logo' 
      ? `${userId}/logo.${fileExt}` 
      : `${userId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(fileName, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new NextResponse(
        JSON.stringify({ error: 'Error uploading file' }),
        { status: 500 }
      );
    }

    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = admin.storage
      .from(bucket)
      .getPublicUrl(fileName);

    // For dealer logos, store just the file path in user metadata
    // This allows us to construct the URL correctly on the client side
    const responseData = { 
      success: true, 
      filePath: `${bucket}/${fileName}`, 
      publicUrl: type === 'logo' ? fileName : publicUrl 
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in upload API:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
