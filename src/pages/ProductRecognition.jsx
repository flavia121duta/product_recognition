import React, { useState } from 'react';

function ProductRecognition() {

     // Stores array of objects: { src: dataURL, data: base64Data, id: uniqueId, type: mimeType }
    const [uploadedImages, setUploadedImages] = useState([]);
    // Stores recognition results for each image: [{ imageId: string, fileName: string, products: [{ productName: string, price: string, brand: string, barcode: string }], error: string }]
    const [individualRecognitionResults, setIndividualRecognitionResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [globalError, setGlobalError] = useState(''); // For errors not tied to a specific image

    const MAX_FILES = 1000; // Define the maximum number of files allowed
    const MAX_ATTEMPTS_PER_IMAGE = 3; // Max attempts for AI recognition per image

    /**
     * Handles file selection from the input, allowing multiple files.
     * Converts each selected image file to a Base64 string and stores its data.
     * @param {Event} event The change event from the file input.
     */
    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files);
       
        // Clear previous state regardless of new files chosen
        setUploadedImages([]);
        setIndividualRecognitionResults([]);
        setGlobalError('');

        if (files.length === 0) {
            return; // No files selected
        }

        if (files.length > MAX_FILES) {
            setGlobalError(`You can only upload a maximum of ${MAX_FILES} files at once. Please select fewer files.`);
            // Clear the input value so the same files can be selected again after error
            event.target.value = null;
            return;
        }

        const newImages = [];
        let filesProcessed = 0;

        files.forEach((file) => {
            const reader = new FileReader();

            reader.onloadend = () => {
                const base64String = reader.result;
                const base64Data = base64String.split(',')[1];
                const mimeType = base64String.split(';')[0].split(':')[1];

                newImages.push({
                    src: base64String,
                    data: base64Data,
                    id: crypto.randomUUID(), // Generate a unique ID for each image
                    type: mimeType,
                    fileName: file.name // Store file name for better identification
                });

                filesProcessed++;
                if (filesProcessed === files.length) {
                    setUploadedImages(prevImages => [...prevImages, ...newImages]);
                }
            };

            reader.onerror = () => {
                setGlobalError(`Failed to read file: ${file.name}.`);
                filesProcessed++;
                if (filesProcessed === files.length) {
                    setUploadedImages(prevImages => [...prevImages, ...newImages]);
                }
            };

            reader.readAsDataURL(file);
        });
    };

    /**
     * Handles the product recognition process by calling the Gemini API for each image individually.
     */
    const handleRecognizeProducts = async () => {
        setIsLoading(true);
        setIndividualRecognitionResults([]); // Clear previous results
        setGlobalError('');

        if (uploadedImages.length === 0) {
            setGlobalError('Please upload one or more images before attempting to recognize products.');
            setIsLoading(false);
            return;
        }

        const results = [];
        // UPDATED PROMPT: Added request for 'barcode' property
        const basePrompt = `Identify all distinct products visible in this image. For each product, extract its name, any visible price, any visible brand, and any visible barcode number.
        Respond with a JSON array where each object has 'productName' (string), 'price' (string, or 'N/A' if no price is visible), 'brand' (string, or 'N/A' if no brand is visible), and 'barcode' (string, or 'N/A' if no barcode is visible).
        If no products are identified, return an empty array [].
        Example:
        [
          {"productName": "Milk (1L)", "price": "$3.49", "brand": "DairyCo", "barcode": "123456789012"},
          {"productName": "Bread (Whole Wheat)", "price": "N/A", "brand": "Bakery Delights", "barcode": "N/A"}
        ]`;
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        for (const image of uploadedImages) {
            let currentRetries = 0;
            let success = false;
            // UPDATED STATE: Added 'barcode' to the product structure
            let imageResult = { imageId: image.id, fileName: image.fileName, products: [], error: '' };

            while (currentRetries < MAX_ATTEMPTS_PER_IMAGE && !success) {
                try {
                    const chatHistory = [];
                    chatHistory.push({ role: "user", parts: [{ text: basePrompt }] });

                    const payload = {
                        contents: [{
                            role: "user",
                            parts: [
                                { text: basePrompt },
                                {
                                    inlineData: {
                                        mimeType: image.type,
                                        data: image.data
                                    }
                                }
                            ]
                        }],
                        generationConfig: { // Requesting structured JSON response
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        "productName": { "type": "STRING" },
                                        "price": { "type": "STRING" },
                                        "brand": { "type": "STRING" },
                                        "barcode": { "type": "STRING" } // ADDED BARCODE PROPERTY HERE
                                    },
                                    "propertyOrdering": ["productName", "price", "brand", "barcode"] // MAINTAIN ORDER
                                }
                            }
                        }
                    };

                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorDetails = await response.json().catch(() => ({})); // Try to parse error, but catch if it's not JSON
                        throw new Error(`API request failed with status ${response.status}: ${errorDetails.error?.message || 'Unknown error'}`);
                    }

                    const rawResponseText = await response.text();
                    console.log(`Raw AI response for Image ID ${image.id} (Attempt ${currentRetries + 1}):`, rawResponseText);

                    if (!rawResponseText || rawResponseText.trim() === '') {
                        imageResult.error = "AI returned an empty response. Retrying...";
                    } else {
                        try {
                            const parsedResult = JSON.parse(rawResponseText);

                            if (parsedResult.candidates && parsedResult.candidates.length > 0 &&
                                parsedResult.candidates[0].content && parsedResult.candidates[0].content.parts &&
                                parsedResult.candidates[0].content.parts.length > 0) {
                                const jsonStringFromAI = parsedResult.candidates[0].content.parts[0].text;
                               
                                if (!jsonStringFromAI || jsonStringFromAI.trim() === '') {
                                    imageResult.error = "AI content part was empty. No products identified. Retrying...";
                                } else {
                                    try {
                                        const parsedProducts = JSON.parse(jsonStringFromAI);
                                        if (Array.isArray(parsedProducts)) {
                                            // Ensure brand and barcode are 'N/A' if missing from AI response for consistency
                                            imageResult.products = parsedProducts.map(p => ({
                                                productName: p.productName || 'N/A',
                                                price: p.price || 'N/A',
                                                brand: p.brand || 'N/A', // Ensure N/A for brand if not provided
                                                barcode: p.barcode || 'N/A' // Ensure N/A for barcode if not provided
                                            }));
                                            success = true; // Mark as successful
                                        } else {
                                            imageResult.error = `AI returned unexpected product data format. Expected an array of products. Retrying...`;
                                            console.error("Unexpected product data format for image ID:", image.id, ":", parsedProducts, "Raw AI content part:", jsonStringFromAI);
                                        }
                                    } catch (parseError) {
                                        if (parseError instanceof SyntaxError && parseError.message.includes("Unexpected end of input")) {
                                            imageResult.error = `AI response was incomplete or cut off for this image. Retrying...`;
                                        } else {
                                            imageResult.error = `Failed to parse AI product JSON. Raw content: ${jsonStringFromAI.substring(0, Math.min(jsonStringFromAI.length, 200))}... Retrying...`;
                                        }
                                        console.error("JSON parse error from AI content part for image ID:", image.id, parseError, "Raw AI content part response:", jsonStringFromAI);
                                    }
                                }
                            } else {
                                imageResult.error = "AI response structure invalid (missing candidates/content). Retrying...";
                                console.error("AI response structure invalid for image ID:", image.id, parsedResult);
                            }
                        } catch (parseError) {
                            if (parseError instanceof SyntaxError && parseError.message.includes("Unexpected end of input")) {
                                imageResult.error = `AI API response was incomplete or cut off. Retrying...`;
                            } else {
                                imageResult.error = `Failed to parse initial AI response as JSON. Raw: ${rawResponseText.substring(0, Math.min(rawResponseText.length, 200))}... Retrying...`;
                            }
                            console.error("Initial JSON parse error for image ID:", image.id, parseError, "Raw response text:", rawResponseText);
                        }
                    }
                } catch (err) {
                    imageResult.error = `Network/Response error: ${err.message}. Retrying...`;
                    console.error(`Error recognizing products for Image ID ${image.id}:`, err);
                }

                if (!success) {
                    currentRetries++;
                    if (currentRetries < MAX_ATTEMPTS_PER_IMAGE) {
                        console.log(`Retrying recognition for Image ID ${image.id}. Attempt ${currentRetries + 1} of ${MAX_ATTEMPTS_PER_IMAGE}`);
                        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay before retry
                    } else {
                        imageResult.error = imageResult.error.replace("Retrying...", "Max retries reached. Please try again later.");
                    }
                }
            }
            results.push(imageResult);
        }

        setIndividualRecognitionResults(results);
        setIsLoading(false);
    };

    /**
     * Helper function to escape CSV values that might contain commas or newlines.
     * @param {string} value The string value to escape.
     * @returns {string} The escaped string.
     */
    const escapeCsvValue = (value) => {
        if (value === null || value === undefined) {
            return '';
        }
        const stringValue = String(value);
        // If the value contains a comma, double quote, or newline, enclose it in double quotes.
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            // Replace double quotes with two double quotes
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };


    /**
     * Exports the recognition results to a CSV file.
     */
    const handleExportToCSV = () => {
        if (individualRecognitionResults.length === 0) {
            setGlobalError('No recognition results to export.');
            return;
        }

        setGlobalError(''); // Clear previous errors

        // UPDATED HEADERS: Added 'Barcode' column
        const headers = ['Image ID', 'File Name', 'Product Name', 'Price', 'Brand', 'Barcode', 'Error'];
        let csvContent = headers.map(escapeCsvValue).join(',') + '\n';

        individualRecognitionResults.forEach(item => {
            if (item.error) {
                // If there's an error for the image, just put the error in a row
                csvContent += [
                    escapeCsvValue(item.imageId),
                    escapeCsvValue(item.fileName),
                    '', // Product Name
                    '', // Price
                    '', // Brand
                    '', // Barcode
                    escapeCsvValue(item.error)
                ].join(',') + '\n';
            } else if (item.products && item.products.length > 0) {
                // If products are recognized, add a row for each product
                item.products.forEach(product => {
                    csvContent += [
                        escapeCsvValue(item.imageId),
                        escapeCsvValue(item.fileName),
                        escapeCsvValue(product.productName),
                        escapeCsvValue(product.price),
                        escapeCsvValue(product.brand || 'N/A'), // Ensure N/A for brand if not provided
                        escapeCsvValue(product.barcode || 'N/A'), // ADDED BARCODE HERE, defaults to 'N/A'
                        '' // No error for this product row
                    ].join(',') + '\n';
                });
            } else {
                // Case where no products were identified and no error occurred (e.g., empty image, or AI said no products)
                csvContent += [
                    escapeCsvValue(item.imageId),
                    escapeCsvValue(item.fileName),
                    'No products identified',
                    'N/A',
                    'N/A', // ADDED 'N/A' for Brand when no products identified
                    'N/A', // ADDED 'N/A' for Barcode when no products identified
                    ''
                ].join(',') + '\n';
            }
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { // Feature detection for HTML5 download attribute
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'product_recognition_results.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // Clean up the URL object
        } else {
            // Fallback for browsers that don't support the download attribute
            window.open(encodeURI("data:text/csv;charset=utf-8," + csvContent));
        }
    };


    return (
        <div className="flex flex-col items-center justify-center p-4 mt-12 font-inter">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full text-center">
                <h1 className="text-4xl font-bold text-gray-800 mb-6">Product Recognition App</h1>

                {/* File Input for Image Upload */}
                <div className="mb-6">
                    <label htmlFor="image-upload" className="block text-gray-700 text-lg font-medium mb-3">
                        Upload Product Images (Max {MAX_FILES} files):
                    </label>
                    <input
                        type="file"
                        id="image-upload"
                        accept="image/*"
                        multiple // Allows multiple file selection
                        onChange={handleImageUpload}
                        className="block w-full text-sm text-gray-500
                                   file:mr-4 file:py-2 file:px-4
                                   file:rounded-full file:border-0
                                   file:text-sm file:font-semibold
                                   file:bg-blue-50 file:text-blue-700
                                   hover:file:bg-blue-100 cursor-pointer
                                   rounded-lg border border-gray-300 p-2"
                    />
                </div>

                {/* Display the selected images */}
                {uploadedImages.length > 0 ? (
                    <div className="mb-8 p-4 border-2 border-dashed border-gray-300 rounded-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {uploadedImages.map((image, index) => (
                            <div key={image.id} className="flex flex-col items-center p-2 border rounded-lg bg-gray-50">
                                <img src={image.src} alt={`Uploaded Product ${index + 1}`} className="max-w-full h-auto rounded-lg mb-2" />
                                <p className="text-sm text-gray-500 truncate w-full px-1">{image.fileName}</p>
                                <p className="text-xs text-gray-600 mt-1 break-all px-1">ID: <span className="font-mono text-blue-700">{image.id}</span></p>
                            </div>
                        ))}
                        <p className="text-sm text-gray-500 col-span-full mt-2">Previews of your uploaded images</p>
                    </div>
                ) : (
                    <div className="mb-8 p-4 border-2 border-dashed border-red-300 rounded-lg bg-red-50 text-red-700">
                        Please upload one or more images to start recognition.
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={handleRecognizeProducts}
                        disabled={isLoading || uploadedImages.length === 0}
                        className={`
                            w-full sm:w-auto flex-grow py-3 px-6 rounded-full text-white font-semibold transition-all duration-300
                            ${isLoading || uploadedImages.length === 0
                                ? 'bg-blue-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transform hover:scale-105'
                            }
                        `}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Recognizing...
                            </div>
                        ) : (
                            'Recognize Products'
                        )}
                    </button>

                    <button
                        onClick={handleExportToCSV}
                        disabled={individualRecognitionResults.length === 0}
                        className={`
                            w-full sm:w-auto flex-grow py-3 px-6 rounded-full text-blue-700 font-semibold transition-all duration-300
                            ${individualRecognitionResults.length === 0
                                ? 'bg-gray-200 cursor-not-allowed'
                                : 'bg-white hover:bg-gray-100 border border-blue-600 shadow-md hover:shadow-lg transform hover:scale-105'
                            }
                        `}
                    >
                        Export Results to CSV
                    </button>
                </div>


                {/* Recognition Result Display */}
                {individualRecognitionResults.length > 0 && (
                    <div className="mt-8 bg-green-50 border border-green-300 text-green-800 p-6 rounded-lg text-left shadow-inner">
                        <h3 className="text-xl font-semibold mb-4">Recognition Results:</h3>
                        {individualRecognitionResults.map((item) => (
                            <div key={item.imageId} className="mb-6 pb-4 border-b border-green-200 last:border-b-0">
                                <h4 className="text-lg font-bold text-gray-800 mb-2">Image: <span className="font-mono text-blue-800">{item.fileName || 'N/A'}</span> (ID: <span className="font-mono text-blue-800">{item.imageId}</span>)</h4>
                                {item.error ? (
                                    <p className="text-red-700 font-semibold">{item.error}</p>
                                ) : item.products && item.products.length > 0 ? (
                                    <ul className="list-disc pl-5">
                                        {item.products.map((product, pIndex) => (
                                            <li key={pIndex} className="mb-1 text-gray-700">
                                                <span className="font-medium">{product.productName}</span>: {product.price || 'Price N/A'} (Brand: {product.brand || 'N/A'}, Barcode: {product.barcode || 'N/A'})
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-700">No distinct products identified.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Global Error Message Display */}
                {globalError && (
                    <div className="mt-8 bg-red-50 border border-red-300 text-red-800 p-6 rounded-lg text-left shadow-inner">
                        <h3 className="text-xl font-semibold mb-3">Error:</h3>
                        <p>{globalError}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProductRecognition;