// pdf-handler.js

const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const archiver = require('archiver');

const s3 = new S3Client({});

exports.compressPdfFiles = async (event) => {
    const sourceBucket = process.env.PDF_SOURCE_BUCKET_NAME;
    const destBucket = process.env.PDF_DEST_BUCKET_NAME;

    // 1. GET PARAMETERS FROM URL (INCLUDING THE NEW fileType)
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const fileType = event.queryStringParameters?.fileType || 'pdf'; // Default to 'pdf' if not provided
    
    const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

    if (!startDate || !endDate || !dateFormat.test(startDate) || !dateFormat.test(endDate)) {
        const message = "Please provide both startDate and endDate in YYYY-MM-DD format.";
        return { statusCode: 400, body: JSON.stringify({ message }) };
    }
    
    // 2. CREATE A DYNAMIC OUTPUT FILENAME
    const outputKey = `compressed/${fileType}-files-from-${startDate}-to-${endDate}.zip`;
    console.log(`ZIPPER: Processing .${fileType} files in bucket ${sourceBucket}`);

    try {
        const listParams = { Bucket: sourceBucket };
        const listedObjects = await s3.send(new ListObjectsV2Command(listParams));

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
             return { statusCode: 404, body: JSON.stringify({ message: `No files found in the source bucket.` }) };
        }

        // 3. FILTER DYNAMICALLY BASED ON THE fileType PARAMETER
        const filteredFiles = listedObjects.Contents.filter(obj => {
            if (!obj.LastModified) return false;
            const lastModifiedDate = obj.LastModified.toISOString().split('T')[0];
            const isDateInRange = lastModifiedDate >= startDate && lastModifiedDate <= endDate;
            // Use the fileType variable here instead of a hardcoded '.pdf'
            const hasCorrectExtension = obj.Key.toLowerCase().endsWith(`.${fileType}`); 
            return isDateInRange && hasCorrectExtension;
        });

        const filesToZipKeys = filteredFiles.map(obj => obj.Key);

        if (filesToZipKeys.length === 0) {
            // 4. MAKE THE ERROR MESSAGE DYNAMIC
            return { statusCode: 404, body: JSON.stringify({ message: `No .${fileType} files found for the date range ${startDate} to ${endDate}.` }) };
        }

        console.log(`Found ${filesToZipKeys.length} .${fileType} files to compress.`);
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        const archiveChunks = [];
        
        archive.on('data', chunk => archiveChunks.push(chunk));
        const archiveStreamFinished = new Promise((resolve, reject) => {
            archive.on('end', resolve);
            archive.on('error', reject);
        });

        for (const key of filesToZipKeys) {
            const s3Object = await s3.send(new GetObjectCommand({ Bucket: sourceBucket, Key: key }));
            archive.append(s3Object.Body, { name: key.split('/').pop() });
        }

        await archive.finalize();
        await archiveStreamFinished;
        
        const zipBuffer = Buffer.concat(archiveChunks);

        await s3.send(new PutObjectCommand({
            Bucket: destBucket,
            Key: outputKey,
            Body: zipBuffer,
            ContentType: 'application/zip'
        }));

        const presignedUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: destBucket, Key: outputKey }), { expiresIn: 3600 });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Successfully compressed ${filesToZipKeys.length} .${fileType} files.`, downloadUrl: presignedUrl }),
        };

    } catch (error) {
        console.error('ZIPPER ERROR:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'An error occurred during the zipping process.' }) };
    }
};