import React, { useState } from 'react';

function ProductRecognition() {

    // Stores array of objects: { src: dataURL, data: base64Data, id: uniqueId, type: mimeType }
    const [uploadedImages, setUploadedImages] = useState([]);
    // Stores recognition results for each image: [{ imageId: string, fileName: string, products: [{ productName: string, price: string, brand: string, barcode: string, weight: string }], error: string }]
    const [individualRecognitionResults, setIndividualRecognitionResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [globalError, setGlobalError] = useState(''); // For errors not tied to a specific image

    // New state for LLM features
    const [selectedProduct, setSelectedProduct] = useState(null); // { imageId, productIndex, productData }
    const [llmResponse, setLlmResponse] = useState('');
    const [isLlmLoading, setIsLlmLoading] = useState(false);
    const [llmError, setLlmError] = useState('');

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
       
        // Clear LLM related states
        setSelectedProduct(null);
        setLlmResponse('');
        setLlmError('');


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
       
        // Clear LLM related states
        setSelectedProduct(null);
        setLlmResponse('');
        setLlmError('');

        if (uploadedImages.length === 0) {
            setGlobalError('Please upload one or more images before attempting to recognize products.');
            setIsLoading(false);
            return;
        }

        const results = [];
        // UPDATED PROMPT: Removed request for 'facings' property
        const basePrompt = `Identify all distinct products visible in this image. For each product, extract its name, any visible price, any visible brand, any visible barcode number, and any visible weight or volume.
        Respond with a JSON array where each object has 'productName' (string), 'price' (string, or 'N/A' if no price is visible), 'brand' (string, or 'N/A' if no brand is visible), 'barcode' (string, or 'N/A' if no barcode is visible), and 'weight' (string, or 'N/A' if no weight/volume is visible).
        If no products are identified, return an empty array [].
        Example:
        [
          {"productName": "Milk (1L)", "price": "$3.49", "brand": "DairyCo", "barcode": "123456789012", "weight": "1L"},
          {"productName": "Bread (Whole Wheat)", "price": "N/A", "brand": "Bakery Delights", "barcode": "N/A", "weight": "400g"}
        ]`;
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        for (const image of uploadedImages) {
            let currentRetries = 0;
            let success = false;
            // UPDATED STATE: Removed 'facings' from the product structure
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
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        "productName": { "type": "STRING" },
                                        "price": { "type": "STRING" },
                                        "brand": { "type": "STRING" },
                                        "barcode": { "type": "STRING" },
                                        "weight": { "type": "STRING" }
                                    },
                                    "propertyOrdering": ["productName", "price", "brand", "barcode", "weight"] // MAINTAIN ORDER
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
                        const errorDetails = await response.json().catch(() => ({}));
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
                                            imageResult.products = parsedProducts.map(p => ({
                                                productName: p.productName || 'N/A',
                                                price: p.price || 'N/A',
                                                brand: p.brand || 'N/A',
                                                barcode: p.barcode || 'N/A',
                                                weight: p.weight || 'N/A'
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
     * Handles selection of a product from the recognized list for LLM actions.
     * @param {string} imageId The ID of the image the product belongs to.
     * @param {number} productIndex The index of the product within the image's products array.
     */
    const handleSelectProduct = (imageId, productIndex) => {
        const imageResult = individualRecognitionResults.find(item => item.imageId === imageId);
        if (imageResult && imageResult.products[productIndex]) {
            setSelectedProduct({
                imageId,
                productIndex,
                productData: imageResult.products[productIndex]
            });
            setLlmResponse(''); // Clear previous LLM response
            setLlmError(''); // Clear previous LLM error
        }
    };

    /**
     * Calls Gemini API to generate a product description.
     */
    const handleGenerateDescription = async () => {
        if (!selectedProduct) {
            setLlmError('Please select a product first.');
            return;
        }

        setIsLlmLoading(true);
        setLlmResponse('');
        setLlmError('');

        const { productName, brand, price, weight } = selectedProduct.productData;
        const descriptionPrompt = `Generează o scurtă descriere de marketing pentru următorul produs, evidențiind numele, brandul, prețul și greutatea/volumul dacă sunt disponibile:
        Nume Produs: ${productName}
        Brand: ${brand !== 'N/A' ? brand : 'necunoscut'}
        Preț: ${price !== 'N/A' ? price : 'indisponibil'}
        Greutate/Volum: ${weight !== 'N/A' ? weight : 'necunoscut'}
        Descrierea ar trebui să fie atractivă și concisă, de maxim 3-4 propoziții.`;
       
        try {
            const chatHistory = [{ role: "user", parts: [{ text: descriptionPrompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown API Error'}`);
            }

            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                setLlmResponse(result.candidates[0].content.parts[0].text);
            } else {
                setLlmError('Nu s-a putut genera o descriere. Încercați din nou.');
            }
        } catch (err) {
            setLlmError(`Eroare la generarea descrierii: ${err.message}.`);
            console.error("LLM description error:", err);
        } finally {
            setIsLlmLoading(false);
        }
    };

    /**
     * Calls Gemini API to suggest usage ideas for a product.
     */
    const handleSuggestUsage = async () => {
        if (!selectedProduct) {
            setLlmError('Please select a product first.');
            return;
        }

        setIsLlmLoading(true);
        setLlmResponse('');
        setLlmError('');

        const { productName, brand, weight } = selectedProduct.productData;
        const usagePrompt = `Sugerează 3-5 idei creative de utilizare pentru următorul produs. Dacă este un aliment, include idei de rețete. Dacă este un produs non-alimentar, sugerează utilizări practice sau inovatoare.
        Nume Produs: ${productName}
        Brand: ${brand !== 'N/A' ? brand : 'necunoscut'}
        Greutate/Volum: ${weight !== 'N/A' ? weight : 'necunoscut'}`;
       
        try {
            const chatHistory = [{ role: "user", parts: [{ text: usagePrompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown API Error'}`);
            }

            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                setLlmResponse(result.candidates[0].content.parts[0].text);
            } else {
                setLlmError('Nu s-au putut genera sugestii de utilizare. Încercați din nou.');
            }
        } catch (err) {
            setLlmError(`Eroare la generarea sugestiilor: ${err.message}.`);
            console.error("LLM usage error:", err);
        } finally {
            setIsLlmLoading(false);
        }
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

        // UPDATED HEADERS: Removed 'Facings' column
        const headers = ['Image ID', 'File Name', 'Product Name', 'Price', 'Brand', 'Barcode', 'Weight', 'Error'];
        let csvContent = headers.map(escapeCsvValue).join(',') + '\n';

        individualRecognitionResults.forEach(item => {
            if (item.error) {
                csvContent += [
                    escapeCsvValue(item.imageId),
                    escapeCsvValue(item.fileName),
                    '', '', '', '', '', // Empty for product details
                    escapeCsvValue(item.error)
                ].join(',') + '\n';
            } else if (item.products && item.products.length > 0) {
                item.products.forEach(product => {
                    csvContent += [
                        escapeCsvValue(item.imageId),
                        escapeCsvValue(item.fileName),
                        escapeCsvValue(product.productName),
                        escapeCsvValue(product.price),
                        escapeCsvValue(product.brand || 'N/A'),
                        escapeCsvValue(product.barcode || 'N/A'),
                        escapeCsvValue(product.weight || 'N/A'),
                        '' // No error for this product row
                    ].join(',') + '\n';
                });
            } else {
                csvContent += [
                    escapeCsvValue(item.imageId),
                    escapeCsvValue(item.fileName),
                    'No products identified', 'N/A', 'N/A', 'N/A', 'N/A', // Removed 'N/A' for Facings
                    ''
                ].join(',') + '\n';
            }
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'product_recognition_results.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            window.open(encodeURI("data:text/csv;charset=utf-8," + csvContent));
        }
    };


    return (
        <div className="min-h-screen flex flex-col items-center mt-4 p-4 font-inter">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full text-center">
                <h1 className="text-4xl font-bold text-gray-800 mb-6">Product Recognition App</h1>

                {/* File Input for Image Upload */}
                <div className="mb-6">
                    <label htmlFor="image-upload" className="block text-gray-700 text-lg font-medium mb-3">
                        Upload product images (Max {MAX_FILES} files):
                    </label>
                    <input
                        type="file"
                        id="image-upload"
                        accept="image/*"
                        multiple
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
                        <p className="text-sm text-gray-500 col-span-full mt-2">Preview of uploaded images</p>
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
                                Recognize...
                            </div>
                        ) : (
                            'Recognise products'
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
                        Export results in CVS
                    </button>
                </div>


                {/* Recognition Result Display */}
                {individualRecognitionResults.length > 0 && (
                    <div className="mt-8 bg-green-50 border border-green-300 text-green-800 p-6 rounded-lg text-left shadow-inner">
                        <h3 className="text-xl font-semibold mb-4">Rezultate Recunoaștere:</h3>
                        {individualRecognitionResults.map((item) => (
                            <div key={item.imageId} className="mb-6 pb-4 border-b border-green-200 last:border-b-0">
                                <h4 className="text-lg font-bold text-gray-800 mb-2">Imagine: <span className="font-mono text-blue-800">{item.fileName || 'N/A'}</span> (ID: <span className="font-mono text-blue-800">{item.imageId}</span>)</h4>
                                {item.error ? (
                                    <p className="text-red-700 font-semibold">{item.error}</p>
                                ) : item.products && item.products.length > 0 ? (
                                    <ul className="list-disc pl-5">
                                        {item.products.map((product, pIndex) => (
                                            <li key={pIndex} className={`mb-1 text-gray-700 cursor-pointer p-1 rounded-md ${selectedProduct?.imageId === item.imageId && selectedProduct?.productIndex === pIndex ? 'bg-blue-100 border border-blue-400' : 'hover:bg-gray-50'}`}
                                                onClick={() => handleSelectProduct(item.imageId, pIndex)}>
                                                <span className="font-medium">{product.productName}</span>: {product.price || 'Price N/A'} (Brand: {product.brand || 'N/A'}, Barcode: {product.barcode || 'N/A'}, Weight: {product.weight || 'N/A'})
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-700">Nu au fost identificate produse distincte.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* LLM Features Section */}
                {selectedProduct && (
                    <div className="mt-8 bg-blue-50 border border-blue-300 text-blue-800 p-6 rounded-lg shadow-inner">
                        <h3 className="text-xl font-semibold mb-4">Funcții AI pentru Produsul Selectat:</h3>
                        <p className="text-gray-700 mb-4">
                            Produs selectat: <span className="font-bold">{selectedProduct.productData.productName}</span> (ID Imagine: <span className="font-mono">{selectedProduct.imageId.substring(0, 8)}...</span>)
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                            <button
                                onClick={handleGenerateDescription}
                                disabled={isLlmLoading}
                                className={`
                                    w-full sm:w-auto flex-grow py-3 px-6 rounded-full text-white font-semibold transition-all duration-300
                                    ${isLlmLoading
                                        ? 'bg-purple-300 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transform hover:scale-105'
                                    }
                                `}
                            >
                                {isLlmLoading ? 'Generare Descriere...' : 'Generează Descriere Produs ✨'}
                            </button>
                            <button
                                onClick={handleSuggestUsage}
                                disabled={isLlmLoading}
                                className={`
                                    w-full sm:w-auto flex-grow py-3 px-6 rounded-full text-white font-semibold transition-all duration-300
                                    ${isLlmLoading
                                        ? 'bg-purple-300 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transform hover:scale-105'
                                    }
                                `}
                            >
                                {isLlmLoading ? 'Generare Sugestii...' : 'Sugestii de Utilizare Produs ✨'}
                            </button>
                        </div>
                        {llmResponse && (
                            <div className="mt-4 bg-blue-100 border border-blue-400 text-blue-800 p-4 rounded-lg text-left whitespace-pre-wrap">
                                <h4 className="font-semibold mb-2">Răspuns AI:</h4>
                                {llmResponse}
                            </div>
                        )}
                        {llmError && (
                            <div className="mt-4 bg-red-100 border border-red-400 text-red-800 p-4 rounded-lg text-left">
                                <h4 className="font-semibold mb-2">Eroare AI:</h4>
                                {llmError}
                            </div>
                        )}
                    </div>
                )}


                {/* Global Error Message Display */}
                {globalError && (
                    <div className="mt-8 bg-red-50 border border-red-300 text-red-800 p-6 rounded-lg text-left shadow-inner">
                        <h3 className="text-xl font-semibold mb-3">Eroare:</h3>
                        <p>{globalError}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProductRecognition;