
import { NextRequest, NextResponse } from "next/server";

import { v2 as cloudinary } from "cloudinary";
import {auth} from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";



 // Configuration
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
  });


  interface CloudinaryUploadResult {
    public_id: string;
    bytes: number;
    duration?: number;
    [key: string]: any;

  }

export async function POST(request: NextRequest) {
    
    try {
      const { userId } = await auth();
      console.log("userId:", JSON.stringify(userId));

      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (
        !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        return NextResponse.json(
          { error: "Missing Cloudinary environment variables" },
          { status: 500 },
        );
      }

      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      // In your video-upload/route.ts
      const title = (formData.get("title") as string).replace(/\0/g, "");
      const description = (formData.get("description") as string).replace(
        /\0/g,
        "",
      );
      const originalSize = (formData.get("originalSize") as string).replace(
        /\0/g,
        "",
      ); // ✅

      console.log("Form data:", { title, description, originalSize });
      if (!file) {
        return NextResponse.json({ error: " file not found" }, { status: 400 });
      }

      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File too large. Please upload a video under 50MB." },
          { status: 400 },
        );
      }
     
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const result = await new Promise<CloudinaryUploadResult>(
        (resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: "video",
              folder: "video-uploads",
              transformation: [{ quality: "auto", fetch_format: "mp4" }], // back to sync
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result as CloudinaryUploadResult);
            },
          );
          uploadStream.end(buffer);
        },
      );
      console.log("Cloudinary result:", {
        public_id: result.public_id,
        bytes: result.bytes,
        duration: result.duration,
      });
      const video = await prisma.video.create({
        data: {
          title: title.replace(/\0/g, ""),
          description: description.replace(/\0/g, ""),
          publicId: result.public_id.replace(/\0/g, ""),
          originalSize: originalSize.replace(/\0/g, ""),
          compressedSize: String(result.bytes).replace(/\0/g, ""),
          duration: result.duration || 0,
        },
      });
      return NextResponse.json(video);
    } catch (error) {
        console.error("Error uploading video:", error);
        return NextResponse.json({error: "Failed to upload video"}, {status: 500});

    }finally {
        await prisma.$disconnect();
    }


    
}