// excel-handler.js

const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const xlsx = require('xlsx');

const s3 = new S3Client({});

const streamToBuffer = (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

exports.mergeExcelFiles = async (event) => {
    const bucketName = process.env.EXCEL_BUCKET_NAME;
    const maxFiles = parseInt(process.env.MAX_FILES_TO_MERGE, 10) || 20;

    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

    if (!startDate || !endDate || !dateFormat.test(startDate) || !dateFormat.test(endDate)) {
        const message = "Please provide both startDate and endDate in YYYY-MM-DD format.";
        return { statusCode: 400, body: JSON.stringify({ message }) };
    }
    
    const outputKey = `output/merged-files-from-${startDate}-to-${endDate}.xlsx`;
    console.log(`EXCEL MERGER: Processing files in bucket: ${bucketName}`);

    try {
        const listParams = { Bucket: bucketName, Prefix: 'input/' };
        const listedObjects = await s3.send(new ListObjectsV2Command(listParams));

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ message: `No files found in the bucket.` }) };
        }

        const filteredFiles = listedObjects.Contents.filter(obj => {
            if (!obj.LastModified) return false;
            const lastModifiedDate = obj.LastModified.toISOString().split('T')[0];
            return lastModifiedDate >= startDate && lastModifiedDate <= endDate && obj.Key.endsWith('.xlsx');
        });

        const excelFileKeys = filteredFiles.map(obj => obj.Key);

        if (excelFileKeys.length === 0) {
            const message = `No .xlsx files found for the date range ${startDate} to ${endDate}.`;
            return { statusCode: 404, body: JSON.stringify({ message }) };
        }

        if (excelFileKeys.length > maxFiles) {
            const message = `Error: Found ${excelFileKeys.length} files, which exceeds the limit of ${maxFiles}.`;
            return { statusCode: 400, body: JSON.stringify({ message }) };
        }

        const newWorkbook = xlsx.utils.book_new();
        const newSheet = xlsx.utils.aoa_to_sheet([[]]);
        let currentRow = 0;
        let isHeaderWritten = false;

        for (const key of excelFileKeys) {
            const getObjectParams = { Bucket: bucketName, Key: key };
            const s3Object = await s3.send(new GetObjectCommand(getObjectParams));
            const buffer = await streamToBuffer(s3Object.Body);
            
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            if (jsonData.length > 0) {
                let dataToAppend = jsonData;
                if (!isHeaderWritten) {
                    isHeaderWritten = true;
                } else {
                    dataToAppend = jsonData.slice(1);
                }
                
                if (dataToAppend.length > 0) {
                    xlsx.utils.sheet_add_aoa(newSheet, dataToAppend, { origin: `A${currentRow + 1}` });
                    currentRow += dataToAppend.length;
                }
            }
        }
        
        if (!isHeaderWritten) {
            return { statusCode: 404, body: JSON.stringify({ message: "No data found in any of the filtered Excel files." }) };
        }

        xlsx.utils.book_append_sheet(newWorkbook, newSheet, 'Combined Data');
        const outputBuffer = xlsx.write(newWorkbook, { bookType: 'xlsx', type: 'buffer' });

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: outputKey,
            Body: outputBuffer,
            ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }));

        const presignedUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: outputKey }), { expiresIn: 3600 });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Successfully merged ${excelFileKeys.length} files.`, downloadUrl: presignedUrl }),
        };

    } catch (error) {
        console.error('EXCEL MERGER ERROR:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'An error occurred during the Excel merging process.' }) };
    }
};