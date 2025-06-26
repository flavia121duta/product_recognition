import React from 'react';

function AboutApp() {
  const explanationText = {
    title: "How to Use the Product Recognition App",
    sections: [
      {
        heading: "1. Upload Your Pictures:",
        content: `First, you'll see a button that says "Upload product images." Click on this to select pictures from your computer or phone. You can pick one image or many at once, up to 1000!
        Once you've chosen your images, you'll see them appear on the screen as small previews. This lets you double-check that you've uploaded the right ones.`
      },
      {
        heading: "2. Recognize Products:",
        content: `After uploading, click the big button that says "Recognise products."
        The app will then send your images to an advanced artificial intelligence (AI). This AI will look at each picture and try to find all the different products in it. It will also try to figure out their names, prices, brands, barcodes, and even their weight or volume.
        This might take a little bit, especially if you've uploaded many images. You'll see a spinning circle and the button will say "Recognize..." to show it's working.`
      },
      {
        heading: "3. View the Results:",
        content: `Once the AI is done, you'll see a section called "Recognition Results."
        For each picture you uploaded, the app will list the products it found. It will show you the product name, price, brand, barcode, and weight.
        If the AI couldn't find any products in a picture, or if there was a problem, it will let you know there too.`
      },
      {
        heading: "4. Get AI Suggestions (Marketing & Usage Ideas):",
        content: `This is where the app gets even smarter! In the "Recognition Results" section, you can click on any of the listed products. When you click on one, it gets highlighted.
        After selecting a product, a new section will appear called "AI Functions for Selected Product."
        Here, you'll have two new buttons:
        "Generate Product Description ✨": Click this to have the AI create a short, catchy marketing description for the product you selected. This is great for selling or advertising!
        "Product Usage Suggestions ✨": Click this for the AI to give you creative ideas on how to use the product. If it's food, it might suggest recipes; if it's something else, it will offer practical or innovative uses.
        The AI's response will then appear below the buttons.`
      },
      {
        heading: "5. Export Results to a Spreadsheet:",
        content: `If you want to keep a record of all the identified products, click the button that says "Export results in CSV."
        This will download a file that you can open in programs like Excel or Google Sheets. It will neatly list all the recognized products, their details, and which image they came from.`
      }
    ],
    conclusion: `That's it! Just upload, recognize, and then explore the smart suggestions the AI can provide.`
  };

  return (
    <div className="min-h-screen flex flex-col font-inter"> {/* Added bg-gray-100 to the outermost div */}

      {/* Main Content Area */}
      <main className="flex-grow flex p-6 sm:p-8">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl p-6 sm:p-10 text-gray-800 prose prose-blue max-w-none mx-auto"> {/* Adjusted max-w and removed flex-col lg:flex-row and overflow-hidden */}
          <h2 className="text-3xl sm:text-4xl font-bold text-blue-700 mb-6 leading-tight">
            {explanationText.title}
          </h2>
          <p className="text-lg sm:text-xl mb-6">
            This app helps you <span className="font-semibold text-blue-600">identify products in your images</span> and then <span className="font-semibold text-blue-600">get smart suggestions about them</span> using artificial intelligence.
          </p>

          {explanationText.sections.map((section, index) => (
            <div key={index} className="mb-8">
              <h3 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-3 flex items-center">
                <span className="text-blue-500 mr-2 text-3xl sm:text-4xl">•</span> {section.heading}
              </h3>
              <p className="text-base sm:text-lg leading-relaxed text-gray-700">
                {section.content}
              </p>
            </div>
          ))}

          <p className="text-lg sm:text-xl font-semibold text-gray-700 mt-8 pt-4 border-t-2 border-dashed border-blue-200">
            {explanationText.conclusion}
          </p>
        </div>
      </main>
    </div>
  );
}

export default AboutApp;