
import React, { useState, useCallback } from 'react';
import { PhotoStyle, Dish } from './types';
import { APP_TITLE, APP_DESCRIPTION, STYLE_CONFIG } from './constants';
import { parseMenu, generateImage, editImage } from './services/geminiService';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { EditIcon } from './components/icons/EditIcon';
import { Spinner } from './components/Spinner';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const StyleSelector: React.FC<{ selectedStyle: PhotoStyle; onStyleChange: (style: PhotoStyle) => void; disabled: boolean }> = ({ selectedStyle, onStyleChange, disabled }) => (
  <div className="flex flex-col sm:flex-row gap-2">
    {Object.values(PhotoStyle).map((style) => (
      <button
        key={style}
        onClick={() => onStyleChange(style)}
        disabled={disabled}
        className={`w-full text-center px-4 py-3 rounded-md transition-all duration-200 text-sm font-semibold border-2 ${
          selectedStyle === style
            ? 'bg-amber-500 border-amber-500 text-gray-900'
            : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {style}
      </button>
    ))}
  </div>
);

const ImageEditor: React.FC<{ dish: Dish; onEdit: (dishId: string, prompt: string) => Promise<void>; onClose: () => void }> = ({ dish, onEdit, onClose }) => {
    const [editPrompt, setEditPrompt] = useState('');

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editPrompt.trim()) return;
        await onEdit(dish.id, editPrompt);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white">&times;</button>
                <h3 className="text-xl font-bold mb-4 text-amber-400">Edit '{dish.name}'</h3>
                <img src={dish.editedImage || dish.originalImage} alt={dish.name} className="w-full h-64 object-cover rounded-md mb-4" />
                <form onSubmit={handleEdit}>
                    <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="e.g., 'Add a retro filter' or 'Make it look spicier'"
                        className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
                        rows={2}
                    />
                    <button type="submit" disabled={!editPrompt.trim() || dish.isEditing} className="w-full flex justify-center items-center gap-2 bg-amber-500 text-gray-900 font-bold py-2 px-4 rounded-md hover:bg-amber-600 transition disabled:opacity-50">
                        {dish.isEditing ? <Spinner /> : <EditIcon />}
                        Apply Edit
                    </button>
                </form>
            </div>
        </div>
    );
};

const DishCard: React.FC<{ dish: Dish; onEditClick: (dish: Dish) => void }> = ({ dish, onEditClick }) => (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden animate-fade-in">
        <div className="relative h-64">
            {dish.isGenerating ? (
                <div className="absolute inset-0 bg-gray-700 flex flex-col items-center justify-center">
                    <Spinner />
                    <p className="text-sm text-gray-400 mt-2">Generating photo...</p>
                </div>
            ) : dish.error ? (
                <div className="absolute inset-0 bg-red-900 bg-opacity-50 flex items-center justify-center p-4">
                    <p className="text-center text-red-300">{dish.error}</p>
                </div>
            ) : (
                <img src={dish.editedImage || dish.originalImage} alt={dish.name} className="w-full h-full object-cover" />
            )}
            {dish.isEditing && (
                 <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center">
                    <Spinner />
                    <p className="text-sm text-gray-300 mt-2">Applying edits...</p>
                </div>
            )}
        </div>
        <div className="p-4 flex justify-between items-center">
            <h3 className="font-semibold text-lg">{dish.name}</h3>
            {!dish.isGenerating && !dish.error && (
                <button
                    onClick={() => onEditClick(dish)}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-md transition text-sm"
                >
                    <EditIcon /> Edit
                </button>
            )}
        </div>
    </div>
);


export default function App() {
  const [menuText, setMenuText] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<PhotoStyle>(PhotoStyle.BrightModern);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string>('');
  const [editingDish, setEditingDish] = useState<Dish | null>(null);

  const handleGenerate = async () => {
    if (!menuText.trim()) {
      setGlobalError('Please enter your menu.');
      return;
    }
    setIsProcessing(true);
    setGlobalError('');
    setDishes([]);

    try {
      const dishNames = await parseMenu(menuText);
      if (!dishNames || dishNames.length === 0) {
        throw new Error("Could not parse any dishes from the menu. Please check the format.");
      }
      
      // Process dishes sequentially to avoid rate limiting
      for (const [index, dishName] of dishNames.entries()) {
        // Add a delay between image generation requests to avoid hitting API rate limits.
        if (index > 0) {
            await sleep(10000); // 10-second delay
        }

        const dishId = crypto.randomUUID();
        
        // Add a placeholder card in 'generating' state to the UI
        const placeholderDish: Dish = {
            id: dishId,
            name: dishName,
            imagePrompt: '',
            originalImage: '',
            isGenerating: true,
            isEditing: false,
            mimeType: '',
        };
        setDishes(prev => [...prev, placeholderDish]);

        try {
          const { base64Image, mimeType, prompt } = await generateImage(dishName, selectedStyle);
          setDishes(prev => prev.map(d => 
            d.id === dishId 
              ? { ...d, originalImage: `data:${mimeType};base64,${base64Image}`, imagePrompt: prompt, isGenerating: false, mimeType } 
              : d
          ));
        } catch (err) {
          console.error(`Error generating image for ${dishName}:`, err);
          let errorMessage = `Failed to generate an image for ${dishName}.`; // A default message
          if (err instanceof Error && err.message) {
            try {
              // API errors are often JSON strings in the message property
              const apiError = JSON.parse(err.message);
              if (apiError?.error?.status === 'RESOURCE_EXHAUSTED') {
                errorMessage = 'Rate limit exceeded. Please wait and try again.';
              } else {
                errorMessage = apiError?.error?.message || `Failed: ${err.message}`;
              }
            } catch (e) {
              // Not a JSON string, so it might be a different error.
              errorMessage = err.message;
            }
          }
          setDishes(prev => prev.map(d => 
            d.id === dishId 
              ? { ...d, isGenerating: false, error: errorMessage } 
              : d
          ));
        }
      }

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setGlobalError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditImage = useCallback(async (dishId: string, prompt: string) => {
    setDishes(prev => prev.map(d => d.id === dishId ? { ...d, isEditing: true } : d));
    
    const dishToEdit = dishes.find(d => d.id === dishId);
    if (!dishToEdit || !dishToEdit.originalImage) return;

    try {
      // Extract base64 data from the data URL
      const base64Data = dishToEdit.originalImage.split(',')[1];
      const { base64Image, mimeType } = await editImage(base64Data, dishToEdit.mimeType, prompt);

      setDishes(prev => prev.map(d => 
        d.id === dishId ? { ...d, editedImage: `data:${mimeType};base64,${base64Image}`, isEditing: false } : d
      ));
    } catch (error) {
        console.error(`Error editing image for ${dishToEdit.name}:`, error);
        setDishes(prev => prev.map(d => 
          d.id === dishId ? { ...d, isEditing: false, error: 'Failed to apply edits.' } : d
        ));
    }
  }, [dishes]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <main className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-amber-400 mb-2">{APP_TITLE}</h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">{APP_DESCRIPTION}</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 mb-8 lg:mb-0">
            <div className="sticky top-8">
              <div className="p-6 bg-gray-800 rounded-lg shadow-lg flex flex-col gap-6">
                <div>
                  <label htmlFor="menu-input" className="block text-lg font-semibold mb-2 text-amber-400">1. Paste Your Menu</label>
                  <textarea
                    id="menu-input"
                    rows={10}
                    value={menuText}
                    onChange={(e) => setMenuText(e.target.value)}
                    placeholder="Spaghetti Carbonara - $18\nMargherita Pizza - $15\nCaesar Salad - $12..."
                    className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={isProcessing}
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2 text-amber-400">2. Select a Style</h2>
                  <StyleSelector selectedStyle={selectedStyle} onStyleChange={setSelectedStyle} disabled={isProcessing} />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing || !menuText.trim()}
                  className="w-full flex justify-center items-center gap-2 bg-amber-500 text-gray-900 font-bold py-3 px-4 rounded-md hover:bg-amber-600 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {isProcessing ? <Spinner /> : <SparklesIcon />}
                  {isProcessing ? 'Generating...' : 'Generate Photos'}
                </button>
                {globalError && <p className="text-red-400 text-center">{globalError}</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {dishes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dishes.map(dish => (
                  <DishCard key={dish.id} dish={dish} onEditClick={setEditingDish} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[50vh] bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-lg">
                <div className="text-center text-gray-500">
                    <p className="text-xl font-semibold">Your generated photos will appear here</p>
                    <p>Enter your menu and click "Generate Photos" to begin.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {editingDish && (
        <ImageEditor 
            dish={editingDish} 
            onEdit={handleEditImage} 
            onClose={() => setEditingDish(null)} 
        />
      )}
    </div>
  );
}
