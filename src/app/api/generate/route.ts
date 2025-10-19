import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import sharp from 'sharp';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Not authenticated' }), 
        { status: 401 }
      );
    }

    const { imageUrl, carDetails } = await request.json();
    
    if (!imageUrl) {
      return new NextResponse(
        JSON.stringify({ error: 'No image URL provided' }), 
        { status: 400 }
      );
    }

    // Build caption server-side for consistency
    const captionParts: string[] = [];
    if (carDetails?.brand) captionParts.push(carDetails.brand);
    if (carDetails?.model) captionParts.push(carDetails.model);
    if (carDetails?.color) captionParts.push(carDetails.color);
    if (carDetails?.fuelType) captionParts.push(carDetails.fuelType);
    if (carDetails?.mileage) captionParts.push(`${Number(carDetails.mileage).toLocaleString()} km`);
    const caption = captionParts.join(' • ');

    // Resolve dealer logo from Supabase Storage (dealer-logos/{dealerId}.png)
    const dealerId = session.user.id;
    const logoPath = `${dealerId}.png`;
    const { data: pubLogo } = supabase.storage
      .from('dealer-logos')
      .getPublicUrl(logoPath);
    const logoUrl = pubLogo?.publicUrl;

    // Download the original image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    
    // Set canvas dimensions (Instagram post size: 1080x1350 for 4:5 ratio)
    const width = 1080;
    const height = 1350;
    
    // Create a new image with white background
    let image = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png();
    
    // Process the original image
    const processedImage = sharp(imageBuffer)
      .resize({
        width: width * 0.9,  // 90% of canvas width
        height: height * 0.7, // 70% of canvas height
        fit: 'inside',
        withoutEnlargement: true
      });
    
    // Composite the original image onto the canvas
    const processedImageBuffer = await processedImage.toBuffer();
    const { width: imgWidth, height: imgHeight } = await sharp(processedImageBuffer).metadata();
    
    // Calculate position to center the image
    const left = Math.floor((width - (imgWidth || 0)) / 2);
    const top = 50; // 50px from top
    
    // Add the processed image to the composition
    image = image.composite([
      {
        input: processedImageBuffer,
        top,
        left,
      }
    ]);
    
    // Add logo if available
    if (logoUrl) {
      try {
        const logoResponse = await fetch(logoUrl);
        const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
        
        const logoSize = 100;
        const logo = await sharp(logoBuffer)
          .resize(logoSize, logoSize, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .toBuffer();
        
        image = image.composite([
          {
            input: logo,
            top: 30, // 30px from top
            left: width - logoSize - 30, // 30px from right
          }
        ]);
      } catch (error) {
        console.error('Error processing logo:', error);
        // Continue without logo if there's an error
      }
    }
    
    // Add caption text
    if (caption) {
      // Create SVG for text overlay
      const captionHeight = 200;
      const svgText = `
        <svg width="${width}" height="${height}">
          <!-- Gradient overlay -->
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="rgba(0,0,0,0)" />
              <stop offset="100%" stop-color="rgba(0,0,0,0.7)" />
            </linearGradient>
          </defs>
          <rect x="0" y="${height - captionHeight}" width="${width}" height="${captionHeight}" fill="url(#gradient)" />
          
          <!-- Caption text -->
          <text 
            x="50%" 
            y="${height - captionHeight + 80}" 
            font-family="Arial, sans-serif" 
            font-size="48" 
            font-weight="bold" 
            fill="white" 
            text-anchor="middle"
          >
            ${caption}
          </text>
          
          <!-- Price -->
          ${carDetails?.price ? `
            <text 
              x="50%" 
              y="${height - captionHeight + 140}" 
              font-family="Arial, sans-serif" 
              font-size="72" 
              font-weight="bold" 
              fill="#4CAF50" 
              text-anchor="middle"
            >
              ₹${carDetails.price}
            </text>
          ` : ''}
        </svg>
      `;
      
      const svgBuffer = Buffer.from(svgText);
      
      // Add the SVG overlay
      image = image.composite([
        {
          input: svgBuffer,
          blend: 'over',
        }
      ]);
    }
    
    // Convert to JPEG buffer
    const outputBuffer = await image.jpeg({ quality: 90 }).toBuffer();
    
    // Generate a unique filename
    const fileName = `${dealerId}/generated/${Date.now()}.jpg`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, outputBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Error uploading generated image');
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);
    
    // Save to database (optional)
    const { error: dbError } = await supabase
      .from('generated_posts')
      .insert([
        { 
          dealer_id: dealerId,
          image_url: publicUrl,
          caption,
          created_at: new Date().toISOString(),
        },
      ]);
    
    if (dbError) {
      console.error('Database error:', dbError);
      // Continue even if database save fails
    }
    
    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      caption,
    });
    
  } catch (error) {
    console.error('Error in generate API:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Error generating image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { status: 500 }
    );
  }
}
