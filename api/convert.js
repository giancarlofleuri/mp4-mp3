import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import axios from 'axios';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);

// Configure FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  api: {
    bodyParser: true, // Enable body parsing to accept JSON
  },
};

export default async function handler(req, res) {
  console.log("Incoming request:", req.method, req.url); // Debug request method and URL

  if (req.method === 'POST') {
    try {
      const { fileUrl } = req.body;

      if (!fileUrl) {
        console.error("No file URL provided"); // Debug missing fileUrl
        return res.status(400).json({ error: 'File URL is required' });
      }

      console.log("File URL received:", fileUrl); // Debug fileUrl

      // Temporary paths for input and output files
      const inputPath = `/tmp/input.mp4`;
      const outputPath = `/tmp/output.mp3`;

      // Step 1: Download the file
      console.log("Starting file download...");
      const response = await axios({
        url: fileUrl,
        method: 'GET',
        responseType: 'stream',
      });

      console.log("File download response headers:", response.headers); // Debug response headers

      const writer = fs.createWriteStream(inputPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log("File downloaded to:", inputPath); // Debug download path

      // Step 2: Convert MP4 to MP3
      console.log("Starting MP4 to MP3 conversion...");
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('mp3')
          .on('start', (commandLine) => {
            console.log("FFmpeg command:", commandLine); // Debug FFmpeg command
          })
          .on('end', resolve)
          .on('error', (err) => {
            console.error("FFmpeg error:", err); // Debug FFmpeg error
            reject(err);
          })
          .save(outputPath);
      });

      console.log("MP3 file saved to:", outputPath); // Debug conversion output path

      // Step 3: Read the MP3 file
      console.log("Reading MP3 file...");
      const mp3Buffer = await fs.promises.readFile(outputPath);

      // Clean up temporary files
      console.log("Cleaning up temporary files...");
      await unlinkAsync(inputPath);
      await unlinkAsync(outputPath);

      // Step 4: Respond with MP3
      console.log("Sending MP3 file...");
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="output.mp3"');
      res.send(mp3Buffer);
    } catch (error) {
      console.error("Error during processing:", error); // Debug any errors
      res.status(500).json({ error: 'Processing failed. Please try again.' });
    }
  } else {
    console.error("Invalid request method:", req.method); // Debug invalid method
    res.status(405).json({ error: 'Method not allowed' });
  }
}
