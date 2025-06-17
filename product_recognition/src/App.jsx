import React, { useState } from 'react';
import "./css/App.css"; // Importing the CSS file for styling

const App = () => {
    // Stores array of objects: { src: dataURL, data: base64Data, id: uniqueId, type: mimeType }
    const [uploadedImages, setUploadedImages] = useState([]);
    // Stores recognition results for each image: [{ imageId: string, fileName: string, products: [{ productName: string, price: string }], error: string }]
    const [individualRecognitionResults, setIndividualRecognitionResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [globalError, setGlobalError] = useState(''); // For errors not tied to a specific image

    /**
     * Handles file selection from the input, allowing multiple files.
     * Converts each selected image file to a Base64 string and stores its data.
     * @param {Event} event The change event from the file input.
     */
    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) {
            setUploadedImages([]);
            setIndividualRecognitionResults([]); // Clear results when new images are uploaded
            return;
        }

        setGlobalError(''); // Clear previous global errors
        setIndividualRecognitionResults([]); // Clear previous results
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
        // Updated prompt to request JSON structured data
        const basePrompt = "Identify all distinct products visible in this image. For each product, extract its name and any visible price. Respond with a JSON array where each object has 'productName' (string) and 'price' (string, or 'N/A' if no price is visible). If no products are identified, return an empty array.";
        const apiKey = "AIzaSyCdIvNF2UJ4tm2bO4NUijrtDc93-HIICAk"; // API key will be provided by Canvas runtime
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        for (const image of uploadedImages) {
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
                                "price": { "type": "STRING" }
                            },
                            "propertyOrdering": ["productName", "price"]
                        }
                    }
                }
            };

            let imageResult = { imageId: image.id, fileName: image.fileName, products: [], error: '' };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error.message}`);
                }

                const result = await response.json();

                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const jsonString = result.candidates[0].content.parts[0].text;
                    try {
                        const parsedProducts = JSON.parse(jsonString);
                        if (Array.isArray(parsedProducts)) {
                            imageResult.products = parsedProducts;
                        } else {
                            // Handle cases where the model might return non-array JSON for some reason
                            imageResult.error = `Unexpected JSON format: ${jsonString}`;
                        }
                    } catch (parseError) {
                        imageResult.error = `Failed to parse AI response: ${jsonString.substring(0, 100)}...`;
                        console.error("JSON parse error:", parseError);
                    }
                } else {
                    imageResult.error = "AI did not return a valid recognition result.";
                }
            } catch (err) {
                console.error(`Error recognizing products for Image ID ${image.id}:`, err);
                imageResult.error = `Failed to recognize products: ${err.message}.`;
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

        // New headers for product details
        const headers = ['Image ID', 'File Name', 'Product Name', 'Price', 'Error'];
        let csvContent = headers.map(escapeCsvValue).join(',') + '\n';

        individualRecognitionResults.forEach(item => {
            if (item.error) {
                // If there's an error for the image, just put the error in a row
                csvContent += [
                    escapeCsvValue(item.imageId),
                    escapeCsvValue(item.fileName),
                    '', // Product Name
                    '', // Price
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
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-inter">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full text-center">
                <h1 className="text-4xl font-bold text-gray-800 mb-6">Product Recognition App</h1>

                {/* File Input for Image Upload */}
                <div className="mb-6">
                    <label htmlFor="image-upload" className="block text-gray-700 text-lg font-medium mb-3">
                        Upload Product Images:
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
                                                <span className="font-medium">{product.productName}</span>: {product.price || 'Price N/A'}
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
};

export default App;
