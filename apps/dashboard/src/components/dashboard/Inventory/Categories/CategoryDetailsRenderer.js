"use client";
import ClothingDetailsSection from './ClothingDetailsSection';
import ShoesDetailsSection from './ShoesDetailsSection';
import AccessoriesDetailsSection from './AccessoriesDetailsSection';
import PerfumesDetailsSection from './PerfumesDetailsSection';
import FoodDetailsSection from './FoodDetailsSection';
import BeveragesDetailsSection from './BeveragesDetailsSection';
import ElectronicsDetailsSection from './ElectronicsDetailsSection';
import BooksDetailsSection from './BooksDetailsSection';
import HomeGardenDetailsSection from './HomeGardenDetailsSection';
import SportsDetailsSection from './SportsDetailsSection';
import AutomotiveDetailsSection from './AutomotiveDetailsSection';
import HealthBeautyDetailsSection from './HealthBeautyDetailsSection';

export default function CategoryDetailsRenderer({
  category,
  formData,
  handleCategoryDetailChange,
  handleArrayFieldChange,
  removeArrayItem,
  detectedColorVariants // New prop passed from parent
}) {
  const hasDetectedVariants = detectedColorVariants && detectedColorVariants.length >= 2;

  return (
    <>
      {category === 'Clothing' && formData.clothingDetails && (
        <ClothingDetailsSection
          clothingDetails={formData.clothingDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
          handleArrayFieldChange={handleArrayFieldChange}
          removeArrayItem={removeArrayItem}
          hasDetectedVariants={hasDetectedVariants}
        />
      )}

      {category === 'Shoes' && formData.shoesDetails && (
        <ShoesDetailsSection
          shoesDetails={formData.shoesDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
          handleArrayFieldChange={handleArrayFieldChange}
          removeArrayItem={removeArrayItem}
          hasDetectedVariants={hasDetectedVariants}
        />
      )}
    
      {category === 'Accessories' && formData.accessoriesDetails && (
        <AccessoriesDetailsSection
          accessoriesDetails={formData.accessoriesDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Perfumes' && formData.perfumeDetails && (
        <PerfumesDetailsSection
          perfumeDetails={formData.perfumeDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Food' && formData.foodDetails && (
        <FoodDetailsSection
          foodDetails={formData.foodDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Beverages' && formData.beveragesDetails && (
        <BeveragesDetailsSection
          beveragesDetails={formData.beveragesDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Electronics' && formData.electronicsDetails && (
        <ElectronicsDetailsSection
          electronicsDetails={formData.electronicsDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Books' && formData.booksDetails && (
        <BooksDetailsSection
          booksDetails={formData.booksDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Home & Garden' && formData.homeGardenDetails && (
        <HomeGardenDetailsSection
          homeGardenDetails={formData.homeGardenDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Sports' && formData.sportsDetails && (
        <SportsDetailsSection
          sportsDetails={formData.sportsDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Automotive' && formData.automotiveDetails && (
        <AutomotiveDetailsSection
          automotiveDetails={formData.automotiveDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    
      {category === 'Health & Beauty' && formData.healthBeautyDetails && (
        <HealthBeautyDetailsSection
          healthBeautyDetails={formData.healthBeautyDetails}
          handleCategoryDetailChange={handleCategoryDetailChange}
        />
      )}
    </>
  );
}
