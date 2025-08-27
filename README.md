# Serverless File Processing API on AWS

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Serverless](https://img.shields.io/badge/serverless-v3-orange)
![Node.js](https://img.shields.io/badge/node-v18.x-green)
![AWS](https://img.shields.io/badge/AWS-Lambda%2C%20S3%2C%20API%20Gateway-FF9900)

A robust, scalable, and cost-effective serverless API built on the AWS cloud for on-the-fly file manipulation. This project provides two main functions: merging multiple Excel (`.xlsx`) files and zipping various file types (`.pdf`, `.docx`, etc.), all orchestrated via a simple RESTful API.

The entire infrastructure is defined as code using the Serverless Framework, allowing for easy deployment, modification, and removal.

---

## ## Key Features

-   **📄 Merge Excel Files**: Aggregates data from multiple `.xlsx` files into a single master spreadsheet, preserving headers correctly.
-   **🗜️ Zip Any File Type**: Dynamically compresses files of a specified type (e.g., `.pdf`, `.docx`, `.txt`) from an S3 bucket into a single `.zip` archive.
-   **📅 Date Range Filtering**: Processes only the files that were last modified within a specified start and end date, giving you precise control over your data.
-   **🔐 Secure & Temporary Access**: Utilizes S3 presigned URLs to provide temporary, secure access to the generated files, which expire after a set duration.
-   **🚀 Serverless & Scalable**: Built with the Serverless Framework on AWS Lambda, ensuring high availability, automatic scaling, and pay-per-use pricing. You only pay when the API is actively processing files.

---

## ## Architecture

The application follows a simple, event-driven serverless architecture that is highly efficient and decoupled.



1.  **Client Request**: A user or application makes an HTTPS `GET` request to an **Amazon API Gateway** endpoint.
2.  **Function Invocation**: API Gateway validates the request and triggers the appropriate **AWS Lambda** function (`mergeExcelFiles` or `compressPdfFiles`).
3.  **File Retrieval**: The Lambda function scans the source **Amazon S3 Bucket** for relevant files based on the query parameters (date range and file type).
4.  **In-Memory Processing**: It downloads the files in-memory, performs the required action (merging or zipping), and prepares the final output file.
5.  **Result Upload**: The newly generated file is uploaded to the destination **Amazon S3 Bucket**.
6.  **Secure URL Generation**: The function generates a temporary, secure **S3 Presigned URL** for the output file.
7.  **API Response**: The presigned URL is returned to the client in a JSON response, allowing for immediate and secure download.

---

## ## API Documentation

The API exposes two primary endpoints.

### ### Endpoint: `/merge-excel`
Merges Excel files from the source S3 bucket into a single `.xlsx` file.

-   **Method**: `GET`
-   **Query Parameters**:
    | Parameter   | Required | Format       | Description                                  |
    | :---------- | :------- | :----------- | :------------------------------------------- |
    | `startDate` | Yes      | `YYYY-MM-DD` | The start date of the filtering range.       |
    | `endDate`   | Yes      | `YYYY-MM-DD` | The end date of the filtering range.         |

### ### Endpoint: `/compress-pdf`
Zips files of a specified type from the source S3 bucket into a single `.zip` file.

-   **Method**: `GET`
-   **Query Parameters**:
    | Parameter   | Required | Format       | Default | Description                                              |
    | :---------- | :------- | :----------- | :------ | :------------------------------------------------------- |
    | `startDate` | Yes      | `YYYY-MM-DD` | -       | The start date of the filtering range.                   |
    | `endDate`   | Yes      | `YYYY-MM-DD` | -       | The end date of the filtering range.                     |
    | `fileType`  | No       | `string`     | `pdf`   | The file extension to zip (e.g., `pdf`, `docx`, `txt`). |

---

## ## Technology Stack

-   **☁️ Cloud Provider**: Amazon Web Services (AWS)
-   **🏗️ Framework**: Serverless Framework v3
-   **λ Compute**: AWS Lambda (Node.js 18.x runtime)
-   **🗄️ Storage**: Amazon S3
-   **🌐 API Layer**: Amazon API Gateway (HTTP API)
-   **🔐 Permissions**: AWS IAM (Identity and Access Management)
-   **📦 Dependencies**: AWS SDK v3, Archiver, XLSX

---

## ## Getting Started

Follow these instructions to deploy the API to your own AWS account.

### ### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v18.x or later) and npm
-   An active [AWS Account](https://aws.amazon.com/free/)
-   [AWS CLI](https://aws.amazon.com/cli/) configured with your credentials
-   [Serverless Framework](https://www.serverless.com/framework/docs/getting-started) installed globally (`npm install -g serverless`)

### ### Installation & Deployment Guide

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/YourUsername/Your-Repository-Name.git](https://github.com/YourUsername/Your-Repository-Name.git)
    cd Your-Repository-Name
    ```

2.  **Install project dependencies:**
    ```bash
    npm install
    ```

3.  ⚠️ **Important: Customize Bucket Names**
    S3 bucket names are globally unique. Before deploying, you **must** change the bucket names in the `serverless.yml` file to something unique to you.
    
    Open `serverless.yml` and modify the `environment` section:
    ```yaml
    # serverless.yml
    provider:
      ...
      environment:
        EXCEL_BUCKET_NAME: your-unique-excel-bucket-name-123
        PDF_SOURCE_BUCKET_NAME: your-unique-source-bucket-name-123
        PDF_DEST_BUCKET_NAME: your-unique-dest-bucket-name-123
    ```

4.  **Deploy the service:**
    Deploy the entire stack (Lambda, S3, IAM Roles, API Gateway) to your AWS account with a single command.
    ```bash
    serverless deploy
    ```
    After a few minutes, the command will complete and output the API endpoints.

---

## ## Usage Examples

After deployment, use the provided API endpoints with a tool like `curl` or Postman.

#### **Merge Excel Files**
```bash
curl "https://<your-api-id>[.execute-api.ap-south-1.amazonaws.com/merge-excel?startDate=2025-08-26&endDate=2025-08-27](https://.execute-api.ap-south-1.amazonaws.com/merge-excel?startDate=2025-08-26&endDate=2025-08-27)"
```

#### **Zip PDF Files (Default)**
```bash
curl "https://<your-api-id>[.execute-api.ap-south-1.amazonaws.com/compress-pdf?startDate=2025-08-26&endDate=2025-08-27](https://.execute-api.ap-south-1.amazonaws.com/compress-pdf?startDate=2025-08-26&endDate=2025-08-27)"
```

#### **Zip Word (.docx) Files**
```bash
curl "https://<your-api-id>[.execute-api.ap-south-1.amazonaws.com/compress-pdf?startDate=2025-08-26&endDate=2025-08-27&fileType=docx](https://.execute-api.ap-south-1.amazonaws.com/compress-pdf?startDate=2025-08-26&endDate=2025-08-27&fileType=docx)"
```

The API will respond with a JSON object containing a `downloadUrl`.

```json
{
  "message": "Successfully compressed 5 .docx files.",
  "downloadUrl": "[https://your-unique-dest-bucket-name-123.s3.ap-south-1.amazonaws.com/](https://your-unique-dest-bucket-name-123.s3.ap-south-1.amazonaws.com/)..."
}
```

---

## ## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details. 
