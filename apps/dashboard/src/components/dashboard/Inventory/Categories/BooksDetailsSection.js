"use client";
import CustomDropdown from "@/components/ui/CustomDropdown";

export default function BooksDetailsSection({
  booksDetails,
  handleCategoryDetailChange
}) {
  if (!booksDetails) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Book Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Book Type</label>
          <CustomDropdown
            options={[
              { value: '', label: 'Select type' },
              { value: 'Fiction', label: 'Fiction' },
              { value: 'Non-Fiction', label: 'Non-Fiction' },
              { value: 'Educational', label: 'Educational' },
              { value: 'Children', label: 'Children' },
              { value: 'Comics/Manga', label: 'Comics/Manga' },
              { value: 'Biography', label: 'Biography' },
              { value: 'Self-Help', label: 'Self-Help' },
              { value: 'Religious', label: 'Religious' },
              { value: 'Business', label: 'Business' },
              { value: 'Cookbook', label: 'Cookbook' },
              { value: 'Other', label: 'Other' }
            ]}
            value={booksDetails.bookType}
            onChange={(value) => handleCategoryDetailChange('books', 'bookType', value)}
            placeholder="Select book type"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
          <input
            type="text"
            value={booksDetails.author}
            onChange={(e) => handleCategoryDetailChange('books', 'author', e.target.value)}
            placeholder="Author name"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ISBN (Optional)</label>
          <input
            type="text"
            value={booksDetails.isbn}
            onChange={(e) => handleCategoryDetailChange('books', 'isbn', e.target.value)}
            placeholder="ISBN number"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <CustomDropdown
            options={[
              { value: 'Paperback', label: 'Paperback' },
              { value: 'Hardcover', label: 'Hardcover' },
              { value: 'eBook', label: 'eBook' },
              { value: 'Audiobook', label: 'Audiobook' }
            ]}
            value={booksDetails.format}
            onChange={(value) => handleCategoryDetailChange('books', 'format', value)}
            placeholder="Select format"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
          <CustomDropdown
            options={[
              { value: 'New', label: 'New' },
              { value: 'Like New', label: 'Like New' },
              { value: 'Very Good', label: 'Very Good' },
              { value: 'Good', label: 'Good' },
              { value: 'Acceptable', label: 'Acceptable' }
            ]}
            value={booksDetails.condition}
            onChange={(value) => handleCategoryDetailChange('books', 'condition', value)}
            placeholder="Select condition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
          <input
            type="text"
            value={booksDetails.language}
            onChange={(e) => handleCategoryDetailChange('books', 'language', e.target.value)}
            placeholder="e.g., English, French"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
          />
        </div>
      </div>
    </div>
  );
}
