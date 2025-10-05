
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionDeclaration, Type } from "@google/genai";

const { useState, useEffect, useRef, useCallback, useMemo } = React;

declare const L: any; // Declare Leaflet and Geoman global
declare const jspdf: any; // Declare jsPDF and autoTable global
declare const html2canvas: any; // Declare html2canvas global

// Add SpeechRecognition to the window object for TypeScript
interface IWindow extends Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}
declare const window: IWindow;


const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- GLOBALIZATION DATA ---
const countries = [
  {
    name: 'Sierra Leone',
    code: 'SL',
    currency: { code: 'SLL', symbol: 'SLL' },
    exchangeRateToUSD: 25000,
    languages: [
      { code: 'en-US', name: 'English' },
      { code: 'kri-SL', name: 'Krio' },
      { code: 'men-SL', name: 'Mende' },
      { code: 'tem-SL', name: 'Temne' },
    ],
  },
  {
    name: 'Nigeria',
    code: 'NG',
    currency: { code: 'NGN', symbol: '₦' },
    exchangeRateToUSD: 1500,
    languages: [
      { code: 'en-NG', name: 'English' },
      { code: 'ha-NG', name: 'Hausa' },
      { code: 'ig-NG', name: 'Igbo' },
      { code: 'yo-NG', name: 'Yoruba' },
    ],
  },
  {
    name: 'Ghana',
    code: 'GH',
    currency: { code: 'GHS', symbol: 'GH₵' },
    exchangeRateToUSD: 15,
    languages: [
      { code: 'en-GH', name: 'English' },
      { code: 'ak-GH', name: 'Akan' },
      { code: 'ee-GH', name: 'Ewe' },
    ],
  },
  {
    name: 'Kenya',
    code: 'KE',
    currency: { code: 'KES', symbol: 'KSh' },
    exchangeRateToUSD: 130,
    languages: [
      { code: 'en-KE', name: 'English' },
      { code: 'sw-KE', name: 'Swahili' },
    ],
  },
  {
    name: 'India',
    code: 'IN',
    currency: { code: 'INR', symbol: '₹' },
    exchangeRateToUSD: 83,
    languages: [
      { code: 'en-IN', name: 'English' },
      { code: 'hi-IN', name: 'Hindi' },
      { code: 'bn-IN', name: 'Bengali' },
      { code: 'te-IN', name: 'Telugu' },
    ],
  },
  {
    name: 'Brazil',
    code: 'BR',
    currency: { code: 'BRL', symbol: 'R$' },
    exchangeRateToUSD: 5.4,
    languages: [
      { code: 'pt-BR', name: 'Portuguese' },
    ],
  },
   {
    name: 'United States',
    code: 'US',
    currency: { code: 'USD', symbol: '$' },
    exchangeRateToUSD: 1,
    languages: [
      { code: 'en-US', name: 'English' },
      { code: 'es-US', name: 'Spanish' },
    ],
  },
];


// --- HELPER FUNCTIONS ---
const imageToGenerativePart = async (file: File) => {
  const base64encodedData = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: base64encodedData, mimeType: file.type },
  };
};

const downloadAsPdf = (textContent: string, filename: string) => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const textWidth = pageWidth - (margin * 2);

    doc.setFontSize(12);
    const lines = doc.splitTextToSize(textContent, textWidth);
    let cursorY = margin + 10;
    
    for (let i = 0; i < lines.length; i++) {
        if (cursorY > pageHeight - margin) {
            doc.addPage();
            cursorY = margin;
        }
        doc.text(lines[i], margin, cursorY);
        cursorY += 7; // Line height
    }
    
    doc.save(filename);
};

const downloadAsWord = (textContent: string, filename:string) => {
    const htmlContent = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Document</title></head><body>
        <div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${textContent.replace(/\n/g, '<br />')}</div>
        </body></html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


// --- UI COMPONENTS ---
const Header = ({ logo, onLogoClick }: { logo: string | null; onLogoClick: () => void }) => (
  <header className="header">
    <div className="logo" onClick={onLogoClick} style={{ cursor: 'pointer' }} title="Change logo">
      {logo ? <img src={logo} alt="Farm Logo" className="header-logo-img" /> : 'FH'}
    </div>
    <h1>FarmHuub</h1>
  </header>
);

const Footer = () => (
    <footer className="footer">
        <h4>Impere Foundation for Education and Agriculture (IFEA)</h4>
        <p>1 lavalie Street, Moriba Town, Bonthe District</p>
        <p>Contact: <a href="tel:+23288635309">+232 88 635 309</a></p>
        <p>Email: <a href="mailto:ifeasalone@gmail.com">ifeasalone@gmail.com</a></p>
    </footer>
);


const Loader = ({ text }: { text?: string }) => (
  <div className="loader">
    <div className="spinner"></div>
    <p>{text || "AI is thinking..."}</p>
  </div>
);

const CountrySelector = ({ selectedCountry, setCountry, countriesList }: { selectedCountry: string; setCountry: (code: string) => void; countriesList: any[] }) => (
    <div className="country-selector-container">
        <label htmlFor="country-select"><i className="fa-solid fa-globe"></i></label>
        <select id="country-select" className="input" value={selectedCountry} onChange={e => setCountry(e.target.value)}>
            {countriesList.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
    </div>
);

const LanguageSelector = ({ language, setLanguage, availableLanguages }: { language: string; setLanguage: (lang: string) => void; availableLanguages: {code: string, name: string}[] }) => (
    <div className="language-selector-container">
        <label htmlFor="language-select"><i className="fa-solid fa-language"></i></label>
        <select id="language-select" className="input" value={language} onChange={e => setLanguage(e.target.value)}>
            {availableLanguages.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
        </select>
    </div>
);

const SettingsBar = ({
    selectedCountry,
    setSelectedCountry,
    availableLanguages,
    language,
    setLanguage
} : {
    selectedCountry: string;
    setSelectedCountry: (code: string) => void;
    availableLanguages: {code: string, name: string}[];
    language: string;
    setLanguage: (code: string) => void;
}) => (
    <div className="settings-bar">
        <CountrySelector countriesList={countries} selectedCountry={selectedCountry} setCountry={setSelectedCountry} />
        <LanguageSelector availableLanguages={availableLanguages} language={language} setLanguage={setLanguage} />
    </div>
);


// --- PAGE COMPONENTS ---

const ScanPage = ({ countryName }: { countryName: string }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files ? e.target.files[0] : null;
    if (selectedFile) {
      setFile(selectedFile);
      setResult("");
      setError("");
    }
  };

  const handleScan = async () => {
    if (!file) {
      setError("Please select an image file first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");

    try {
      const imagePart = await imageToGenerativePart(file);
      const prompt = `You are an expert botanist, plant pathologist, and soil scientist for agriculture in ${countryName}. Analyze this image. 

If it's a healthy plant, identify it and provide:
1.  **Plant Name:** (Common and Scientific)
2.  **Uses for Humans:** (Food, traditional medicine, etc.)
3.  **Uses for Animals:** (Fodder, habitat, etc.)
4.  **Environmental Role:** (Nitrogen fixation, soil stabilization, etc.)
5.  **Cultivation Tips:** (Basic advice for local farmers)

If it's a diseased plant, provide a diagnosis:
1.  **Plant Identification:** The name of the plant.
2.  **Disease Diagnosis:** The name of the suspected disease. Be specific.
3.  **Causes & Symptoms:** Describe the visual symptoms and explain the common causes (fungal, bacterial, viral, nutrient deficiency).
4.  **Treatment - Organic/Cultural Methods:** Provide actionable, low-cost recommendations suitable for small-scale farmers (e.g., removing infected leaves, crop rotation, natural sprays).
5.  **Treatment - Chemical Methods:** Suggest appropriate chemical treatments (fungicides, pesticides) if applicable, including a disclaimer to use them safely and according to instructions.
6.  **Prevention:** List key strategies to prevent future outbreaks.

If it's a soil, analyze it and provide:
1.  **Soil Type:** (e.g., Loamy, Sandy, Clay)
2.  **Visual Health Assessment:** (Color, texture clues)
3.  **Potential Nutrient Status:** (What the visuals might imply)
4.  **Natural Improvement Recommendations:** (e.g., composting, cover crops, local organic matter)

Base your analysis on common crops, diseases, and conditions found in ${countryName}. Present the information clearly with bold headings.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, {text: prompt}] },
      });

      setResult(response.text);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze the image. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <h2>Crop Disease Diagnosis</h2>
      <div className="card">
        <h3>Upload an Image for Analysis</h3>
        <input type="file" id="file-upload" accept="image/*" onChange={handleFileChange} ref={fileInputRef} style={{display: 'none'}} />
        <label htmlFor="file-upload" className="file-input-label">
            <i className="fa-solid fa-camera"></i>
            {file ? file.name : "Choose a photo..."}
        </label>
        
        <button onClick={handleScan} disabled={!file || loading} className="button">
          {loading ? "Analyzing..." : "Scan with AI"}
        </button>
      </div>
      {loading && <Loader text="Analyzing image..." />}
      {error && <p className="error-text">{error}</p>}
      {result && (
        <div className="card">
          <h3>Analysis Result</h3>
          <div className="result-box">{result}</div>
        </div>
      )}
    </div>
  );
};

const BlendPage = ({ countryName }: { countryName: string }) => {
  const commonPlants = ["Cassava Leaves", "Moringa", "Ginger", "Garlic", "Turmeric", "Neem Leaves", "Sweet Potato Leaves", "Hibiscus (Sorrel)"];
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [customPlant, setCustomPlant] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const handleTogglePlant = (plant: string) => {
    setSelectedPlants(prev => 
      prev.includes(plant) 
        ? prev.filter(p => p !== plant) 
        : [...prev, plant]
    );
  };

  const handleAddCustomPlant = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPlant.trim() && !selectedPlants.includes(customPlant.trim())) {
      setSelectedPlants(prev => [...prev, customPlant.trim()]);
      setCustomPlant('');
    }
  };

  const handleGenerateBlend = async () => {
    if (selectedPlants.length < 2) {
      setError('Please select at least two plants to blend.');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');

    try {
      const prompt = `You are an expert ethnobotanist and nutritionist specializing in the flora of ${countryName}. Analyze the following blend of plants: ${selectedPlants.join(', ')}.

Provide a detailed analysis of their combined properties. The output should be well-structured with clear Markdown headings.

1.  **Blend Name:** A creative, descriptive name for this mixture.
2.  **Human Uses (Food):** Describe how this blend can be used in cooking. Suggest a simple recipe or preparation method relevant to the local cuisine.
3.  **Human Uses (Medicinal):** Detail the traditional medicinal applications. What health benefits might this combination offer? What ailments could it potentially alleviate? **Always include a strong disclaimer to consult a healthcare professional before use.**
4.  **Animal Uses (Livestock):** Can this blend be used as a food supplement or natural remedy for common livestock? If so, how?
5.  **Agricultural Uses:** Explain if this mixture can be used as a natural pesticide, fungicide, or soil amendment/fertilizer. Provide simple instructions for preparation.
6.  **Important Precautions:** List any potential side effects, contraindications, or warnings associated with this blend for humans or animals.`;

      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      setResult(response.text);
    } catch (err) {
      console.error(err);
      setError("Failed to generate blend analysis. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <h2>Plant & Crop Blender</h2>
      <div className="card">
        <h3>1. Select Plants & Crops</h3>
        <p style={{marginBottom: '15px', color: 'var(--text-light)'}}>Select from the list or add your own.</p>
        
        <div className="plant-selection-grid">
          {commonPlants.map(plant => (
            <button 
              key={plant}
              className={`plant-chip ${selectedPlants.includes(plant) ? 'selected' : ''}`}
              onClick={() => handleTogglePlant(plant)}
            >
              {plant}
            </button>
          ))}
        </div>

        <form onSubmit={handleAddCustomPlant} className="custom-plant-form">
          <input 
            type="text" 
            className="input" 
            placeholder="Add a custom plant..."
            value={customPlant}
            onChange={e => setCustomPlant(e.target.value)}
          />
          <button type="submit" className="button" style={{width: 'auto', padding: '12px 15px'}}>+</button>
        </form>
      </div>

      <div className="card">
        <h3>2. Review & Generate</h3>
        <div className="selected-plants-display">
          {selectedPlants.length > 0 ? (
            selectedPlants.map(plant => (
              <span key={plant} className="selected-plant-tag">
                {plant} 
                <button onClick={() => handleTogglePlant(plant)}>&times;</button>
              </span>
            ))
          ) : (
            <p style={{color: 'var(--text-light)'}}>No plants selected yet.</p>
          )}
        </div>
        <button 
          className="button" 
          onClick={handleGenerateBlend} 
          disabled={loading || selectedPlants.length < 2}
          style={{marginTop: '15px'}}
        >
          {loading ? "Blending..." : "Blend with AI"}
        </button>
      </div>
      
      {loading && <Loader text="Creating blend analysis..." />}
      {error && <p className="error-text">{error}</p>}
      {result && (
        <div className="card">
          <h3>Blend Analysis</h3>
          <div className="result-box">{result}</div>
        </div>
      )}
    </div>
  );
};


// --- COMMUNITY SUB-PAGES ---
const MarketSubPage = () => {
    const initialProducts = [
        { id: 1, name: "Fresh Cassava", price: "SLL 50,000/bag", seller: "Fatu Kamara", icon: "fa-solid fa-carrot", image: null },
        { id: 2, name: "Organic Palm Oil", price: "SLL 30,000/L", seller: "Musa Bangura", icon: "fa-solid fa-bottle-droplet", image: null },
        { id: 3, name: "Groundnuts", price: "SLL 25,000/kg", seller: "Aminata Sesay", icon: "fa-solid fa-seedling", image: null },
        { id: 4, name: "Sweet Potatoes", price: "SLL 40,000/bag", seller: "John Koroma", icon: "fa-solid fa-leaf", image: null },
    ];

    const [products, setProducts] = useState(initialProducts);
    const [showForm, setShowForm] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', price: '', description: '' });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewItem(prev => ({ ...prev, [name]: value }));
    };
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleListProduct = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name || !newItem.price) return;
        
        const newProduct = {
            id: Date.now(),
            name: newItem.name,
            price: newItem.price,
            seller: "You",
            icon: "fa-solid fa-user-tag",
            image: imagePreview
        };
        
        setProducts(prev => [newProduct, ...prev]);
        
        // Reset form
        setShowForm(false);
        setNewItem({ name: '', price: '', description: '' });
        setImageFile(null);
        setImagePreview(null);
    };

    return (
        <div>
             <button className="button" style={{marginBottom: '20px'}} onClick={() => setShowForm(!showForm)}>
                <i className="fa-solid fa-plus" style={{marginRight: '8px'}}></i>
                {showForm ? 'Cancel' : 'Sell Your Produce'}
            </button>
            
            {showForm && (
                <div className="card">
                    <h3>List a New Item</h3>
                    <form onSubmit={handleListProduct} className="add-transaction-form" style={{borderTop: 'none', paddingTop: '0', marginTop: '0'}}>
                        <label htmlFor="product-image-upload" className="file-input-label">
                            {imagePreview ? <img src={imagePreview} alt="Preview" className="logo-preview" style={{maxHeight: '80px'}} /> : <span><i className="fa-solid fa-camera"></i> Add Photo</span>}
                        </label>
                        <input id="product-image-upload" type="file" accept="image/*" onChange={handleImageChange} style={{display: 'none'}} />

                        <label>Product Name</label>
                        <input type="text" name="name" className="input" placeholder="e.g., Organic Groundnuts" value={newItem.name} onChange={handleInputChange} required />

                        <label>Price</label>
                        <input type="text" name="price" className="input" placeholder="e.g., SLL 30,000 / kg" value={newItem.price} onChange={handleInputChange} required />
                        
                        <label>Description (Optional)</label>
                        <textarea name="description" className="textarea small" placeholder="Describe your product..." value={newItem.description} onChange={handleInputChange}></textarea>
                        
                        <button className="button" type="submit">List Item for Sale</button>
                    </form>
                </div>
            )}

            <div className="product-grid">
                {products.map(p => (
                    <div className="product-card" key={p.id}>
                        <div className="product-image">
                            {p.image ? <img src={p.image} alt={p.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <i className={p.icon}></i>}
                        </div>
                        <div className="product-info">
                            <h4>{p.name}</h4>
                            <p>by {p.seller}</p>
                            <p className="product-price">{p.price}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FeedSubPage = ({ communityPosts, addCommunityPost }: { communityPosts: any[], addCommunityPost: (post: any) => void }) => {
    const [postContent, setPostContent] = useState('');

    const handleCreatePost = (e: React.FormEvent) => {
        e.preventDefault();
        if (!postContent.trim()) return;
        addCommunityPost({
            author: "You",
            avatar: "You",
            content: postContent,
            image: false
        });
        setPostContent('');
    };
    
    return (
        <>
            <div className="card">
                <form onSubmit={handleCreatePost}>
                    <textarea 
                        className="textarea" 
                        placeholder="Share an update with the community..."
                        value={postContent}
                        onChange={e => setPostContent(e.target.value)}
                    ></textarea>
                    <button className="button" type="submit" disabled={!postContent.trim()}>
                        <i className="fa-solid fa-paper-plane"></i> Post Update
                    </button>
                </form>
            </div>

            {communityPosts.length === 0 ? (
                 <div className="card"><p>No posts in the feed yet.</p></div>
            ) : (
                communityPosts.map((post) => (
                <div className="card post-card" key={post.id}>
                    <div className="post-header">
                        <div className="avatar">{post.avatar}</div>
                        <span className="post-author">{post.author}</span>
                    </div>
                    {post.image && <div className="post-image"></div>}
                    <div className="post-content">{post.content}</div>
                    <div className="post-actions">
                        <i className="fa-regular fa-heart"></i>
                        <i className="fa-regular fa-comment"></i>
                        <i className="fa-solid fa-share-nodes"></i>
                    </div>
                </div>
            )))}
        </>
    );
};

const ChatsSubPage = () => {
    const dummyChats = [
        { id: 1, name: 'Fatu Kamara', avatar: 'FK', lastMessage: 'See you at the market tomorrow!', time: '10:45 AM', unread: 2 },
        { id: 2, name: 'Musa Bangura', avatar: 'MB', lastMessage: 'The new fertilizer is working well.', time: 'Yesterday', unread: 0 },
        { id: 3, name: 'Farmers Cooperative', avatar: 'FC', lastMessage: 'Aminata: Meeting is scheduled for Friday.', time: '3 days ago', unread: 0 },
    ];
    const [selectedChat, setSelectedChat] = useState<any>(null);
    const [message, setMessage] = useState('');

    if (selectedChat) {
        return (
            <div className="chat-view-container">
                <div className="chat-view-header">
                    <button onClick={() => setSelectedChat(null)} className="back-button"><i className="fa-solid fa-arrow-left"></i></button>
                    <div className="avatar">{selectedChat.avatar}</div>
                    <span className="chat-view-name">{selectedChat.name}</span>
                </div>
                <div className="chat-messages">
                    <div className="chat-message ai-message">Hey! Are you going to the market?</div>
                    <div className="chat-message user-message">Yes, I plan to be there around noon.</div>
                     <div className="chat-message ai-message">{selectedChat.lastMessage}</div>
                </div>
                <form className="chat-input-form" onSubmit={(e) => e.preventDefault()}>
                    <input type="text" placeholder="Type a message..." value={message} onChange={e => setMessage(e.target.value)} />
                    <button type="submit" className="send-button" disabled={!message.trim()}><i className="fa-solid fa-paper-plane"></i></button>
                </form>
            </div>
        )
    }

    return (
        <div className="card">
            <h3>Conversations</h3>
            <ul className="chat-list">
                {dummyChats.map(chat => (
                    <li key={chat.id} className="chat-list-item" onClick={() => setSelectedChat(chat)}>
                        <div className="avatar">{chat.avatar}</div>
                        <div className="chat-item-details">
                            <div className="chat-item-header">
                                <strong>{chat.name}</strong>
                                <span>{chat.time}</span>
                            </div>
                            <div className="chat-item-message">
                                <p>{chat.lastMessage}</p>
                                {chat.unread > 0 && <span className="unread-badge">{chat.unread}</span>}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const CallsSubPage = () => {
    const dummyCallHistory = [
        { id: 1, name: 'Aminata Sesay', type: 'video', direction: 'outgoing', duration: '12m 34s', time: '1h ago' },
        { id: 2, name: 'John Koroma', type: 'audio', direction: 'incoming', duration: '5m 02s', time: '3h ago' },
        { id: 3, name: 'Musa Bangura', type: 'audio', direction: 'missed', time: 'Yesterday' },
    ];
    const [callState, setCallState] = useState({ active: false, type: '', name: '' });

    const startCall = (type: 'audio' | 'video', name: string) => {
        setCallState({ active: true, type, name });
        setTimeout(() => setCallState({ active: false, type: '', name: '' }), 4000); // Simulate a 4-second call
    };

    const getCallIcon = (item: any) => {
        const icon = item.type === 'video' ? 'fa-video' : 'fa-phone';
        let directionIcon;
        if (item.direction === 'outgoing') directionIcon = 'fa-arrow-up-right-from-square';
        else if (item.direction === 'incoming') directionIcon = 'fa-arrow-down-left-and-arrow-up-right-to-center';
        else directionIcon = 'fa-phone-slash';
        return <><i className={`fa-solid ${icon}`}></i><i className={`fa-solid ${directionIcon} direction-icon`}></i></>;
    };

    if (callState.active) {
        return (
            <div className="modal-overlay">
                <div className="call-screen-ui">
                    <div className="avatar large">{callState.name.substring(0,2).toUpperCase()}</div>
                    <h3>Calling {callState.name}...</h3>
                    <p>Simulated {callState.type} call</p>
                    <div className="call-controls">
                        <button className="call-control-btn"><i className="fa-solid fa-microphone-slash"></i></button>
                        <button className="call-control-btn end-call" onClick={() => setCallState({active: false, type: '', name: ''})}><i className="fa-solid fa-phone-slash"></i></button>
                        <button className="call-control-btn"><i className="fa-solid fa-volume-high"></i></button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="card">
                <h3>Start a Call</h3>
                <p className="card-subtitle">Connect with others in the community.</p>
                <div className="actions-container">
                    <button className="button-secondary" onClick={() => startCall('audio', 'Fatu Kamara')}>
                        <i className="fa-solid fa-phone"></i> Audio Call
                    </button>
                    <button className="button" onClick={() => startCall('video', 'Musa Bangura')}>
                         <i className="fa-solid fa-video"></i> Video Call
                    </button>
                </div>
            </div>
            <div className="card">
                <h3>Call History</h3>
                <ul className="call-history-list">
                    {dummyCallHistory.map(item => (
                        <li key={item.id} className={`call-history-item ${item.direction}`}>
                            <div className="call-icon">{getCallIcon(item)}</div>
                            <div className="call-details">
                                <strong>{item.name}</strong>
                                <span>{item.duration || 'Missed Call'} &bull; {item.time}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
};

const MeetingsSubPage = () => {
    const dummyMeetings = [
        { id: 1, topic: 'Weekly Crop Review', time: 'Today at 4:00 PM', attendees: ['You', 'Fatu', 'Musa'], status: 'upcoming' },
        { id: 2, topic: 'Market Pricing Strategy', time: 'Tomorrow at 11:00 AM', attendees: ['You', 'Aminata', 'John'], status: 'upcoming' },
        { id: 3, topic: 'Q2 Planning Session', time: 'Last Tuesday', attendees: ['You', 'Fatu', 'Musa', 'Aminata', 'John'], status: 'past' },
    ];
    const [isMeetingActive, setIsMeetingActive] = useState(false);
    const [showScheduler, setShowScheduler] = useState(false);

    if (isMeetingActive) {
        return (
             <div className="modal-overlay">
                <div className="meeting-screen-ui">
                    <h3>Weekly Crop Review (Simulated)</h3>
                    <div className="participant-grid">
                        <div className="participant-tile"><div className="avatar large">You</div><span>You</span></div>
                        <div className="participant-tile"><div className="avatar large">FK</div><span>Fatu Kamara</span></div>
                        <div className="participant-tile"><div className="avatar large">MB</div><span>Musa Bangura</span></div>
                        <div className="participant-tile"><div className="avatar large">AS</div><span>Aminata Sesay</span></div>
                    </div>
                    <div className="meeting-controls">
                        <button className="call-control-btn"><i className="fa-solid fa-microphone-slash"></i></button>
                        <button className="call-control-btn"><i className="fa-solid fa-video-slash"></i></button>
                        <button className="call-control-btn"><i className="fa-solid fa-desktop"></i></button>
                        <button className="call-control-btn end-call" onClick={() => setIsMeetingActive(false)}><i className="fa-solid fa-phone-slash"></i></button>
                    </div>
                </div>
            </div>
        )
    }
    
    return (
        <>
            <div className="card">
                <h3>Virtual Meetings</h3>
                 <button className="button" onClick={() => setShowScheduler(!showScheduler)}>
                    <i className="fa-solid fa-calendar-plus" style={{marginRight: '8px'}}></i>
                    {showScheduler ? 'Cancel' : 'Schedule New Meeting'}
                </button>
                {showScheduler && (
                    <form className="add-transaction-form" onSubmit={(e) => { e.preventDefault(); setShowScheduler(false); }}>
                        <label>Topic</label>
                        <input type="text" className="input" placeholder="e.g., Q3 Planning" required />
                        <label>Date & Time</label>
                        <input type="datetime-local" className="input" required />
                        <button className="button" type="submit">Schedule Meeting</button>
                    </form>
                )}
            </div>
            <div className="card">
                <h3>Upcoming Meetings</h3>
                <ul className="meeting-list">
                    {dummyMeetings.filter(m => m.status === 'upcoming').map(m => (
                        <li key={m.id} className="meeting-card">
                            <strong>{m.topic}</strong>
                            <p><i className="fa-regular fa-clock"></i> {m.time}</p>
                            <p><i className="fa-solid fa-users"></i> {m.attendees.join(', ')}</p>
                            <button className="button" style={{padding: '8px 16px', fontSize: '14px'}} onClick={() => setIsMeetingActive(true)}>
                                <i className="fa-solid fa-video"></i> Start Meeting
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
};

const VideoSubPage = ({ countryName }: { countryName: string }) => {
    // Script generation state
    const [projectName, setProjectName] = useState('FarmHuub Launch Video');
    const [targetAudience, setTargetAudience] = useState(`Small-to-medium scale farmers, agricultural entrepreneurs, and farming cooperatives in ${countryName}.`);
    const [keyMessage, setKeyMessage] = useState('FarmHuub is an essential, modern tool for farmers, highlighting its key benefits: ease of use, empowerment through knowledge, and business growth.');
    const [videoLength, setVideoLength] = useState('30 seconds');
    const [videoStyle, setVideoStyle] = useState('Inspirational');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    
    // Video generation state
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [videoGenerationMessage, setVideoGenerationMessage] = useState('');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoError, setVideoError] = useState('');

    useEffect(() => {
        setTargetAudience(`Small-to-medium scale farmers, agricultural entrepreneurs, and farming cooperatives in ${countryName}.`);
    }, [countryName]);

    const isFormValid = () => {
        return projectName.trim() && targetAudience.trim() && keyMessage.trim();
    };

    const handleGenerateScript = async () => {
        if (!isFormValid()) {
            setError('Please fill out all required fields: Project Name, Target Audience, and Key Message.');
            return;
        }

        setLoading(true);
        setError('');
        setResult('');
        setVideoUrl(null);
        setVideoError('');

        try {
            const prompt = `
You are a professional marketing video producer specializing in short-form social media content for an agricultural audience in ${countryName}.

Your task is to create a complete script and storyboard for a marketing video based on the following project details:

- **Project Name:** "${projectName}"
- **Target Audience:** "${targetAudience}"
- **Key Message:** "${keyMessage}"
- **Desired Video Length:** "${videoLength}"
- **Desired Video Style/Tone:** "${videoStyle}"

Please structure your output with the following format, using Markdown for clear headings. For each scene, provide these details:

---

**Scene # (e.g., Scene 1)**
*   **Timecode:** (e.g., 0:00 - 0:10)
*   **Visual:** Describe the on-screen action, camera shots (e.g., close-up, wide shot), and setting in detail.
*   **Voiceover (VO):** Write the script for the narrator.
*   **On-Screen Text:** List any text or graphics that should appear on screen.

---

Ensure the script is engaging, culturally relevant to ${countryName}, and effectively communicates the key message within the specified time limit. The storyboard (visual descriptions) should be vivid and achievable with a modest budget.
`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setResult(response.text);
        } catch (err) {
            console.error(err);
            setError("Failed to generate the video script. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateMovie = async () => {
        if (!result) return;
        setIsGeneratingVideo(true);
        setVideoError('');
        setVideoUrl(null);
        
        try {
            // 1. Summarize script for video prompt
            setVideoGenerationMessage('Summarizing script for video prompt...');
            const summaryPrompt = `Summarize the following video script into a single, concise, and visually descriptive paragraph. This summary will be used as a prompt for an AI video generation model. Focus on the key visual elements, actions, and the overall mood.

Script:
---
${result}
---
`;
            const summaryResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: summaryPrompt });
            const videoPrompt = summaryResponse.text;

            // 2. Start video generation
            setVideoGenerationMessage('Starting video generation... This may take a few minutes.');
            let operation = await ai.models.generateVideos({
                model: 'veo-2.0-generate-001',
                prompt: videoPrompt,
                config: { numberOfVideos: 1 }
            });

            const messages = [
                'AI is directing the scenes...',
                'Rendering the first cut...',
                'Adding special effects...',
                'Polishing the final frames...',
                'Almost ready, hang tight!'
            ];
            let messageIndex = 0;

            // 3. Poll for completion
            while (!operation.done) {
                setVideoGenerationMessage(messages[messageIndex % messages.length]);
                messageIndex++;
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            // 4. Fetch the video
            setVideoGenerationMessage('Finalizing your video...');
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) {
                throw new Error('Video generation completed, but no download link was found.');
            }

            const videoResponse = await fetch(`${downloadLink}&key=${API_KEY}`);
            if (!videoResponse.ok) {
                throw new Error('Failed to download the generated video.');
            }
            const videoBlob = await videoResponse.blob();
            const objectUrl = URL.createObjectURL(videoBlob);
            setVideoUrl(objectUrl);

        } catch (err) {
            console.error(err);
            setVideoError('An error occurred during video generation. Please try again.');
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    return (
        <>
            <div className="card">
                <h3>Agribusiness Video Producer</h3>
                <p className="card-subtitle">Describe your project, and the AI will create a professional video script and then generate the movie itself.</p>

                <label htmlFor="project-name">Project Name</label>
                <input id="project-name" type="text" className="input" value={projectName} onChange={e => setProjectName(e.target.value)} />
                
                <label htmlFor="target-audience">Target Audience</label>
                <textarea id="target-audience" className="textarea" value={targetAudience} onChange={e => setTargetAudience(e.target.value)}></textarea>
                
                <label htmlFor="key-message">Key Message</label>
                <textarea id="key-message" className="textarea" value={keyMessage} onChange={e => setKeyMessage(e.target.value)}></textarea>

                <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                    <div style={{flex: 1, minWidth: '120px'}}>
                        <label htmlFor="video-length">Video Length</label>
                        <select id="video-length" className="input" value={videoLength} onChange={e => setVideoLength(e.target.value)}>
                            <option>30 seconds</option>
                            <option>1 minute</option>
                            <option>90 seconds</option>
                            <option>2 minutes</option>
                        </select>
                    </div>
                     <div style={{flex: 1, minWidth: '120px'}}>
                        <label htmlFor="video-style">Video Style</label>
                        <select id="video-style" className="input" value={videoStyle} onChange={e => setVideoStyle(e.target.value)}>
                            <option>Inspirational</option>
                            <option>Educational</option>
                            <option>Humorous</option>
                            <option>Cinematic</option>
                            <option>Direct & Informative</option>
                        </select>
                    </div>
                </div>

                <button className="button" onClick={handleGenerateScript} disabled={loading || isGeneratingVideo}>
                    {loading ? "Generating Script..." : "1. Generate Video Script"}
                </button>
            </div>

            {loading && <Loader text="Drafting your video script..." />}
            {error && <p className="error-text">{error}</p>}
            
            {result && (
                <div className="card">
                    <h3>Generated Script & Storyboard</h3>
                    <div className="result-box">{result}</div>
                    <div className="result-actions">
                        <button className="button-secondary" onClick={() => downloadAsPdf(result, `${projectName.replace(/ /g, '_')}_Script.pdf`)}>
                            <i className="fa-solid fa-file-pdf"></i> Download PDF
                        </button>
                        <button className="button-secondary" onClick={() => downloadAsWord(result, `${projectName.replace(/ /g, '_')}_Script.doc`)}>
                            <i className="fa-solid fa-file-word"></i> Download Word
                        </button>
                    </div>
                     <button className="button" onClick={handleGenerateMovie} disabled={isGeneratingVideo} style={{marginTop: '15px'}}>
                        {isGeneratingVideo ? "Generating Movie..." : "2. Generate Movie from Script"}
                    </button>
                </div>
            )}

            {isGeneratingVideo && <Loader text={videoGenerationMessage} />}
            {videoError && <p className="error-text">{videoError}</p>}
            
            {videoUrl && (
                <div className="card">
                    <h3>Generated Video</h3>
                    <video src={videoUrl} controls style={{width: '100%', borderRadius: 'var(--border-radius)', backgroundColor: '#000'}} />
                    <a href={videoUrl} download={`${projectName.replace(/ /g, '_')}.mp4`} className="button" style={{marginTop: '15px', textDecoration: 'none', textAlign: 'center'}}>
                         <i className="fa-solid fa-download"></i> Download Video
                    </a>
                </div>
            )}
        </>
    );
};

const CommunityPage = ({ communityPosts, addCommunityPost, countryName }: { communityPosts: any[], addCommunityPost: (post: any) => void, countryName: string }) => {
  const [activeSubTab, setActiveSubTab] = useState('feed');

  const renderSubPage = () => {
    switch (activeSubTab) {
      case 'feed': return <FeedSubPage communityPosts={communityPosts} addCommunityPost={addCommunityPost} />;
      case 'chats': return <ChatsSubPage />;
      case 'market': return <MarketSubPage />;
      case 'calls': return <CallsSubPage />;
      case 'meetings': return <MeetingsSubPage />;
      case 'video': return <VideoSubPage countryName={countryName} />;
      default: return <FeedSubPage communityPosts={communityPosts} addCommunityPost={addCommunityPost} />;
    }
  };

  const tabs = [
    { id: 'feed', label: 'Feed', icon: 'fa-solid fa-rss' },
    { id: 'chats', label: 'Chats', icon: 'fa-solid fa-comments' },
    { id: 'market', label: 'Market', icon: 'fa-solid fa-store' },
    { id: 'calls', label: 'Calls', icon: 'fa-solid fa-phone-volume' },
    { id: 'meetings', label: 'Meetings', icon: 'fa-solid fa-video' },
    { id: 'video', label: 'Video', icon: 'fa-solid fa-film' },
  ];

  return (
    <div>
      <h2>Community Hub</h2>
      <div className="sub-nav">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`sub-nav-button ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            <i className={tab.icon}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="sub-page-content">
        {renderSubPage()}
      </div>
    </div>
  );
};

// --- Type definition for Survey History ---
type Survey = {
  id: number;
  name: string;
  address: string;
  contact: string;
  date: string;
  area: number;
  geojson: any; // GeoJSON object
};

const LandPage = ({ countryName }: { countryName: string }) => {
  const [userName, setUserName] = useState('');
  const [landSize, setLandSize] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<{ text: string; image: string | null } | null>(null);
  const [error, setError] = useState('');
  const [directionsQuery, setDirectionsQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState('');
  
  const [calculatedArea, setCalculatedArea] = useState<number | null>(null);
  const [surveyHistory, setSurveyHistory] = useState<Survey[]>([]);
  const [currentSurveyGeoJSON, setCurrentSurveyGeoJSON] = useState<any | null>(null);
  const [surveyCoordinates, setSurveyCoordinates] = useState<{lat: number, lng: number}[]>([]);
  const [coordsVisible, setCoordsVisible] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [surveyName, setSurveyName] = useState('');
  const [surveyAddress, setSurveyAddress] = useState('');
  const [surveyContact, setSurveyContact] = useState('');

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const surveyedLayerRef = useRef<any>(null);

  useEffect(() => {
    try {
        const savedSurveys = localStorage.getItem('farmHubSurveyHistory');
        if (savedSurveys) {
            setSurveyHistory(JSON.parse(savedSurveys));
        }
    } catch (e) { console.error("Failed to parse survey history", e); }

    if (typeof L === 'undefined' || !mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current).setView([8.4844, -13.2344], 9);
    L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3'],
        attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
    }).addTo(map);

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawPolygon: true,
      drawFreehand: true,
      drawCircle: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
      editMode: true,
      dragMode: true,
      removalMode: true,
    });
    
    map.pm.setGlobalOptions({ pinning: true, snappable: true });

    const handleLayerUpdate = (layer: any) => {
        const areaMeters = L.PM.Utils.getArea(layer);
        const areaHectares = areaMeters / 10000;
        const latlngs = layer.getLatLngs()[0];
        const coords = latlngs.map((p: any) => ({ lat: p.lat, lng: p.lng }));

        setCalculatedArea(areaHectares);
        setLandSize(areaHectares.toFixed(4));
        setSurveyCoordinates(coords);
        setCurrentSurveyGeoJSON(layer.toGeoJSON());
        setShowSaveForm(true); 
    };

    map.on('pm:create', (e: any) => {
        if (surveyedLayerRef.current) {
            map.removeLayer(surveyedLayerRef.current);
        }
        const layer = e.layer;
        surveyedLayerRef.current = layer;
        handleLayerUpdate(layer);
        map.pm.disableDraw();

        if(mapRef.current) {
            mapRef.current.fitBounds(layer.getBounds().pad(0.1));
        }

        layer.on('pm:edit', (edit_e: any) => handleLayerUpdate(edit_e.layer));
    });

    map.on('pm:remove', () => {
        setCalculatedArea(null);
        setLandSize('');
        setSurveyCoordinates([]);
        setCurrentSurveyGeoJSON(null);
        setShowSaveForm(false);
        setSurveyName('');
        setSurveyAddress('');
        setSurveyContact('');
        surveyedLayerRef.current = null;
    });

    mapRef.current = map;
    
    return () => {
        if(mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('farmHubSurveyHistory', JSON.stringify(surveyHistory));
  }, [surveyHistory]);

  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationQuery || !mapRef.current) return;

    setIsSearchingLocation(true);
    setLocationSearchError('');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        mapRef.current.setView([lat, lon], 17); // Zoom in close
      } else {
        setLocationSearchError('Location not found. Please try a different search term.');
      }
    } catch (err) {
      console.error("Failed to fetch location", err);
      setLocationSearchError('Failed to search for location. Please check your connection.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleGenerate = async () => {
    if (!userName || !landSize || (!surveyedLayerRef.current && surveyCoordinates.length === 0)) {
      setError('Please enter your name and survey a piece of land on the map.');
      return;
    }
    setLoading(true);
    setError('');
    setGeneratedDoc(null);

    try {
        let mapImage: string | null = null;
        if (mapContainerRef.current && surveyedLayerRef.current && mapRef.current) {
            mapRef.current.fitBounds(surveyedLayerRef.current.getBounds().pad(0.1));
            await new Promise(resolve => setTimeout(resolve, 500));
            const canvas = await html2canvas(mapContainerRef.current, { useCORS: true });
            mapImage = canvas.toDataURL('image/jpeg', 0.8);
        }
        
        let coordinatesText = 'Not available.';
        if (surveyCoordinates && surveyCoordinates.length > 0) {
            coordinatesText = surveyCoordinates.map(p => `  - Latitude: ${p.lat.toFixed(6)}, Longitude: ${p.lng.toFixed(6)}`).join('\n');
        }

        const prompt = `You are a professional land surveyor in ${countryName}. Create a formal, automated survey plan document for a client named ${userName}.

**Client:** ${userName}
**Total Area:** ${landSize} hectares
**Country:** ${countryName}

The document must include the following sections, formatted professionally with proper spacing and headings:
1.  **Title:** "AUTOMATED LAND SURVEY PLAN".
2.  **Client Details:** Client's Name and Date of Survey (use today's date).
3.  **Property Description:** A general description of the land's location.
4.  **Boundary Coordinates:** A crucial section listing the precise geographical demarcation points. Format this section exactly as follows, using the data provided:
    
    BEGIN BOUNDARY COORDINATES
    The property is demarcated by the following geographical coordinates:
${coordinatesText}
    END BOUNDARY COORDINATES

5.  **Land Suitability Analysis:** Suggest crops that grow well in the local soil and climate of ${countryName}.
6.  **Declaration of Survey:** A formal statement of accuracy regarding the automated survey.
7.  **Surveyor's Signature:** A closing section for a signature.

Generate only the text for this document. The visual sketch of the map will be attached separately.`;
        
        const response = await ai.models.generateContent({model: 'gemini-2.5-flash', contents: prompt });
        setGeneratedDoc({ text: response.text, image: mapImage });
    } catch (err) {
      console.error(err);
      setError("Failed to generate the survey plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleGetDirections = (e: React.FormEvent) => {
      e.preventDefault();
      if (!directionsQuery) return;
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsQuery)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  const handleSaveSurvey = (e: React.FormEvent) => {
      e.preventDefault();
      if (!surveyName || !surveyAddress || !currentSurveyGeoJSON || calculatedArea === null) return;
      
      const newSurvey: Survey = {
          id: Date.now(),
          name: surveyName,
          address: surveyAddress,
          contact: surveyContact,
          date: new Date().toISOString(),
          area: calculatedArea,
          geojson: currentSurveyGeoJSON,
      };
      
      setSurveyHistory(prev => [newSurvey, ...prev]);
      setShowSaveForm(false);
      setSurveyName('');
      setSurveyAddress('');
      setSurveyContact('');
  };
  
  const handleViewSurvey = (id: number) => {
      const survey = surveyHistory.find(s => s.id === id);
      if (!survey || !mapRef.current) return;
      
      if (surveyedLayerRef.current) {
          mapRef.current.removeLayer(surveyedLayerRef.current);
      }
      
      const surveyLayer = L.geoJSON(survey.geojson).addTo(mapRef.current);
      surveyedLayerRef.current = surveyLayer.getLayers()[0]; // L.geoJSON creates a layer group
      
      const coords = surveyLayer.getLayers()[0].getLatLngs()[0].map((p: any) => ({ lat: p.lat, lng: p.lng }));

      setCalculatedArea(survey.area);
      setLandSize(survey.area.toFixed(4));
      setSurveyCoordinates(coords);
setCurrentSurveyGeoJSON(survey.geojson);
      setShowSaveForm(false);
      
      mapRef.current.fitBounds(surveyLayer.getBounds().pad(0.1));
      
      // Optional: Populate the generator form
      setSurveyName(survey.name);
      // setUserName(...); // Could set this if we add a client name to survey object
  };

  const handleDeleteSurvey = (id: number) => {
      if(window.confirm("Are you sure you want to delete this survey?")) {
          setSurveyHistory(prev => prev.filter(s => s.id !== id));
      }
  };

  const handleDownloadPDF = () => {
    if (!generatedDoc) return;
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const textWidth = pageWidth - (margin * 2);

    doc.setFontSize(12);
    const lines = doc.splitTextToSize(generatedDoc.text, textWidth);
    let cursorY = margin + 10;
    
    for (let i = 0; i < lines.length; i++) {
        if (cursorY > pageHeight - margin) {
            doc.addPage();
            cursorY = margin;
        }
        doc.text(lines[i], margin, cursorY);
        cursorY += 7; // Line height
    }
    
    if (generatedDoc.image) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text("Appendix A: Surveyed Area Sketch", pageWidth / 2, margin + 5, { align: 'center' });
        
        const imgWidth = 180;
        const imgHeight = 100;
        const imgX = (pageWidth - imgWidth) / 2;
        const imgY = margin + 20;

        doc.addImage(generatedDoc.image, 'JPEG', imgX, imgY, imgWidth, imgHeight);
    }
    doc.save('Survey_Plan.pdf');
  };

  const handleDownloadWord = () => {
    if (!generatedDoc) return;

    const textContent = `<div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${generatedDoc.text.replace(/\n/g, '<br />')}</div>`;
    const imageContent = generatedDoc.image 
        ? `
            <br clear="all" style="page-break-before:always" />
            <h2>Appendix A: Surveyed Area Sketch</h2>
            <img src="${generatedDoc.image}" alt="Map of surveyed area" style="max-width: 600px;" />
        ` 
        : '';
    const htmlContent = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Survey Plan</title></head><body>
        ${textContent}${imageContent}
        </body></html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Survey_Plan.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  return (
    <div>
      <h2>Land Survey & Planning</h2>
      <div className="card map-card">
          <h3>Map Survey & Directions</h3>
          <p style={{marginBottom: '10px', color: 'var(--text-light)'}}>Search for a location, or use the toolbar to draw/edit an area.</p>
          
          <form className="directions-form" onSubmit={handleLocationSearch}>
              <input 
                type="text" 
                className="input" 
                placeholder="Search for a town or city..." 
                value={locationQuery} 
                onChange={e => setLocationQuery(e.target.value)} 
              />
              <button type="submit" className="button" disabled={isSearchingLocation}>
                {isSearchingLocation ? <div className="spinner-small"></div> : <i className="fa-solid fa-magnifying-glass"></i>}
              </button>
          </form>
          {locationSearchError && <p className="error-text" style={{marginBottom: '10px'}}>{locationSearchError}</p>}

          <hr className="form-divider" />

          <form className="directions-form" onSubmit={handleGetDirections}>
              <input 
                type="text" 
                className="input" 
                placeholder="Enter a location for directions" 
                value={directionsQuery} 
                onChange={e => setDirectionsQuery(e.target.value)} 
              />
              <button type="submit" className="button" aria-label="Get Directions"><i className="fa-solid fa-diamond-turn-right"></i></button>
          </form>
          
          <div className="map-container" ref={mapContainerRef}></div>
      </div>

      {calculatedArea !== null && (
          <div className="card">
              <h3>Current Survey Details</h3>
              <div className="survey-result" style={{textAlign: 'left', marginBottom: '15px', border: 'none', padding: '0'}}>
                  <p><strong>Surveyed Area:</strong> {calculatedArea.toFixed(4)} Hectares</p>
              </div>
              <button className="button-secondary" onClick={() => setCoordsVisible(!coordsVisible)} style={{marginBottom: '15px'}}>
                  {coordsVisible ? 'Hide' : 'Show'} Coordinates <i className={`fa-solid ${coordsVisible ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              </button>
              {coordsVisible && (
                  <div className="result-box" style={{maxHeight: '150px'}}>
                      <ul>
                          {surveyCoordinates.map((coord, index) => (
                              <li key={index}>Point {index + 1}: {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}</li>
                          ))}
                      </ul>
                  </div>
              )}
          </div>
      )}

      {showSaveForm && (
          <div className="card">
              <h3>Save Survey</h3>
              <p className="card-subtitle">Add this survey to your history.</p>
              <form onSubmit={handleSaveSurvey}>
                  <label>Area Name</label>
                  <input type="text" className="input" placeholder="e.g., North Field" value={surveyName} onChange={e => setSurveyName(e.target.value)} required />
                  <label>Address / Location Details</label>
                  <textarea className="textarea small" placeholder="e.g., Near the old mango tree" value={surveyAddress} onChange={e => setSurveyAddress(e.target.value)} required></textarea>
                  <label>Contact Number (Optional)</label>
                  <input type="tel" className="input" placeholder="e.g., 088 123 4567" value={surveyContact} onChange={e => setSurveyContact(e.target.value)} />
                  <button type="submit" className="button">Save to History</button>
              </form>
          </div>
      )}

      <div className="card">
        <h3>Generate Automated Survey Plan</h3>
        <input type="text" className="input" placeholder="Enter Your Full Name" value={userName} onChange={e => setUserName(e.target.value)} />
        <input type="text" className="input" placeholder="Survey land on map to get size" value={landSize} onChange={e => setLandSize(e.target.value)} readOnly={calculatedArea !== null} />
        <button className="button" onClick={handleGenerate} disabled={loading || !userName || !landSize}>
          {loading ? "Generating..." : "Generate Plan"}
        </button>
      </div>
      {loading && <Loader text="Capturing map & generating plan..." />}
      {error && <p className="error-text">{error}</p>}
      {generatedDoc && (
        <div className="card">
          <h3>Document Ready</h3>
          <p className="card-subtitle" style={{marginTop: '0'}}>Your survey plan has been generated. Download it in your preferred format.</p>
          <div className="result-actions">
              <button className="button-secondary" onClick={handleDownloadPDF}>
                  <i className="fa-solid fa-file-pdf"></i> Download PDF
              </button>
              <button className="button" onClick={handleDownloadWord}>
                  <i className="fa-solid fa-file-word"></i> Download Word
              </button>
          </div>
        </div>
      )}
      
      <div className="card">
          <h3>Survey History</h3>
          {surveyHistory.length === 0 ? (
              <p style={{color: 'var(--text-light)'}}>No surveys saved yet. Use the map tools to draw an area and save it.</p>
          ) : (
              <ul className="survey-history-list">
                  {surveyHistory.map(survey => (
                      <li key={survey.id} className="survey-history-item">
                          <div className="survey-info">
                              <strong>{survey.name}</strong>
                              <span>{survey.area.toFixed(4)} Hectares - {new Date(survey.date).toLocaleDateString()}</span>
                              <p>{survey.address}</p>
                              {survey.contact && <p>Contact: {survey.contact}</p>}
                          </div>
                          <div className="survey-actions">
                              <button onClick={() => handleViewSurvey(survey.id)} aria-label="View on map"><i className="fa-solid fa-eye"></i></button>
                              <button onClick={() => handleDeleteSurvey(survey.id)} aria-label="Delete survey"><i className="fa-solid fa-trash-can"></i></button>
                          </div>
                      </li>
                  ))}
              </ul>
          )}
      </div>
    </div>
  );
};


const AIHubPage = ({
    language, setLanguage,
    selectedCountry, setSelectedCountry,
    availableLanguages, countryName
} : {
    language: string; setLanguage: (l: string) => void;
    selectedCountry: string; setSelectedCountry: (c: string) => void;
    availableLanguages: any[]; countryName: string;
}) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<{role: string; text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const langName = availableLanguages.find(l => l.code === language)?.name || 'English';
    const newChat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are an expert agricultural assistant for farmers. Your name is 'FarmHuub Agri-Bot'. Answer questions about agriculture, crop diseases, food production, supply chains, and climate change. Provide helpful, accurate, and easy-to-understand information tailored to the user's local context in ${countryName}. The user has selected their language as ${langName}. You MUST respond in ${langName}. Start your very first message by introducing yourself in ${langName}.`
        },
    });
    setChat(newChat);
    setMessages([]); // Clear previous chat history

    setLoading(true);
    newChat.sendMessage({message: "Hello!"}).then(response => {
        setMessages([{ role: 'ai', text: response.text }]);
        setLoading(false);
    }).catch(err => {
        console.error("Initial AI message failed", err);
        setMessages([{ role: 'ai', text: "Welcome to the AI Hub! How can I help you today?" }]);
        setLoading(false);
    });

  }, [language, countryName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chat || loading || isRecording) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
        const response = await chat.sendMessage({ message: input });
        setMessages(prev => [...prev, { role: 'ai', text: response.text }]);
    } catch (err) {
        console.error(err);
        setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
        setLoading(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Sorry, your browser doesn't support speech recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = language;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      setInput('');
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result) => result.transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Automatically send the message after speaking
      if(input.trim()) {
        const form = document.getElementById('chat-form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    };

    recognition.start();
  };

  return (
      <div style={{display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)'}}>
        <h2>AI Agri-Bot</h2>
        <SettingsBar 
            selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry}
            availableLanguages={availableLanguages} language={language} setLanguage={setLanguage}
        />
        <div className="chat-window">
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}>
                        {msg.text}
                    </div>
                ))}
                 {loading && messages.length > 0 && (
                    <div className="chat-message ai-message">
                        <div className="spinner" style={{width: '20px', height: '20px'}}></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form id="chat-form" className="chat-input-form" onSubmit={sendMessage}>
                <input 
                    type="text" 
                    placeholder={isRecording ? "Listening..." : "Ask about agriculture..."} 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    disabled={loading} />
                <button 
                    type="button" 
                    className={`mic-button ${isRecording ? 'recording' : ''}`}
                    onClick={handleToggleRecording}
                    disabled={loading}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                >
                    <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                </button>
                <button type="submit" className="send-button" disabled={loading || !input.trim()} aria-label="Send message">
                    <i className="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        </div>
      </div>
  );
};

// --- FARM ADMIN SUB-PAGES ---
type Transaction = { id: number; type: 'income' | 'expense'; description: string; amount: number; date: string; };
type DocItem = { description: string; quantity: number; price: number; };

const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'SLL 0';
    return `SLL ${Math.round(value).toLocaleString('en-US')}`;
}

const FinanceSubPage = ({ logo, onLogoChange }: { logo: string | null; onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }) => {
    // --- STATE FROM FinanceSubPage ---
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState<'income' | 'expense'>('income');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [loadingTip, setLoadingTip] = useState(false);
    const [financialQuery, setFinancialQuery] = useState('');
    const [financialTip, setFinancialTip] = useState('');
    const [error, setError] = useState('');

    // --- STATE FROM AccountantSubPage ---
    const [loadingReport, setLoadingReport] = useState(false);
    const [report, setReport] = useState('');
    const [reportError, setReportError] = useState('');
    const [activityLog, setActivityLog] = useState([
        { id: 1, text: "AI Accountant Initialized.", time: new Date().toLocaleTimeString() }
    ]);

    // --- STATE FROM PaymentIntegrationsSubPage ---
    const [accountType, setAccountType] = useState('Mobile Money');
    const [provider, setProvider] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [linkedAccounts, setLinkedAccounts] = useState<{id: number; type: string; provider: string; identifier: string;}[]>([]);
    const [loadingLink, setLoadingLink] = useState(false);
    const [linkError, setLinkError] = useState('');

    // --- NEW STATE FOR BUSINESS PROFILE ---
    const [farmName, setFarmName] = useState(localStorage.getItem('farmHubFarmName') || 'Your Farm Name');
    const [farmAddress, setFarmAddress] = useState(localStorage.getItem('farmHubFarmAddress') || 'Your Farm Address');
    
    // --- STATE FOR DOCUMENT TEMPLATE GENERATOR ---
    const [docType, setDocType] = useState('Invoice');
    const [docData, setDocData] = useState({
        from: 'FarmHuub Inc.\n1 Lavalie Street\nBonthe District',
        to: '',
        items: [{ description: '', quantity: 1, price: 0 }] as DocItem[],
        notes: 'Thank you for your business.',
        taxRate: 0,
    });
    const [showPreview, setShowPreview] = useState(false);


    // --- EFFECTS ---
    useEffect(() => {
        // For transactions
        try {
            const savedTransactions = localStorage.getItem('farmAdminTransactions');
            if (savedTransactions) {
                setTransactions(JSON.parse(savedTransactions));
            } else {
                 const dummyTransactions: Transaction[] = [
                    { id: 1, type: 'income', description: 'Sold 10 bags of cassava', amount: 500000, date: '2024-05-20' },
                    { id: 2, type: 'expense', description: 'Purchase of fertilizer', amount: 150000, date: '2024-05-18' },
                    { id: 3, type: 'income', description: 'Sold palm oil', amount: 250000, date: '2024-05-15' },
                    { id: 4, type: 'expense', description: 'Fuel for generator', amount: 80000, date: '2024-05-12' },
                ];
                setTransactions(dummyTransactions);
            }
        } catch (e) { console.error("Failed to parse transactions from localStorage", e); }
        
        // For linked accounts
        try {
            const savedAccounts = localStorage.getItem('farmHubLinkedAccounts');
             if (savedAccounts) {
                setLinkedAccounts(JSON.parse(savedAccounts));
            } else {
                const dummyAccounts = [
                    { id: 1, type: 'Mobile Money', provider: 'Orange Money', identifier: '088 123 4567' }
                ];
                setLinkedAccounts(dummyAccounts);
            }
        } catch (e) { console.error("Failed to parse linked accounts from localStorage", e); }
    }, []);

    useEffect(() => {
        localStorage.setItem('farmAdminTransactions', JSON.stringify(transactions));
    }, [transactions]);

    useEffect(() => {
        localStorage.setItem('farmHubLinkedAccounts', JSON.stringify(linkedAccounts));
    }, [linkedAccounts]);

    useEffect(() => {
        setDocData(prev => ({
            ...prev,
            from: `${farmName}\n${farmAddress}`
        }));
    }, [farmName, farmAddress]);

    // --- DERIVED STATE ---
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netProfit = totalIncome - totalExpenses;
    
    // Derived state for doc generator
    const subtotal = docData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const taxAmount = subtotal * (docData.taxRate / 100);
    const grandTotal = subtotal + taxAmount;

    // --- HANDLERS & HELPERS from FinanceSubPage ---
    const handleOpenForm = (type: 'income' | 'expense') => {
        setFormType(type);
        setShowForm(true);
        setDescription('');
        setAmount('');
        setFinancialTip('');
    };

    const handleAddTransaction = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || !amount) return;
        const newTransaction: Transaction = {
            id: Date.now(), type: formType, description: description.trim(),
            amount: parseFloat(amount), date: new Date().toLocaleDateString('en-CA'),
        };
        setTransactions(prev => [newTransaction, ...prev]);
        setShowForm(false);
    };
    
    const handleAskFinancialAdvisor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!financialQuery.trim()) return;

        setLoadingTip(true);
        setFinancialTip('');
        setError('');
        try {
            const prompt = `You are a financial advisor for small-scale farmers in Sierra Leone. The user's current financial summary is below. Answer their specific question based on this context. The currency is Sierra Leonean Leones (SLL).

**Financial Summary:**
- Total Income: ${formatCurrency(totalIncome)}
- Total Expenses: ${formatCurrency(totalExpenses)}
- Net Profit/Loss: ${formatCurrency(netProfit)}
- Recent Transactions:
  - ${transactions.slice(0, 5).map(t => `${t.type}: ${t.description} - ${formatCurrency(t.amount)}`).join('\n  - ')}

**User's Question:** "${financialQuery}"

Provide a practical, actionable answer that is relevant to the local context of Sierra Leone. Keep the language simple and encouraging. If the question is not related to finance or farming, gently decline to answer.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setFinancialTip(response.text);
        } catch (err) {
            console.error(err);
            setError("Sorry, I couldn't generate a tip right now. Please try again.");
        } finally { setLoadingTip(false); }
    };
    
    // --- HANDLERS & HELPERS from AccountantSubPage ---
    const addLog = (text: string) => {
        setActivityLog(prev => [{ id: Date.now(), text, time: new Date().toLocaleTimeString() }, ...prev]);
    };

    const handleGenerateReport = async () => {
        if (transactions.length === 0) {
            setReportError("Please add transactions in the 'Finance' tab first to generate a report.");
            return;
        }
        setLoadingReport(true);
        setReport('');
        setReportError('');
        addLog("Generating audited financial report...");
        try {
            const transactionSummary = transactions.map(t => `${t.date} | ${t.type.toUpperCase()} | ${t.description} | ${formatCurrency(t.amount)}`).join('\n');
            const prompt = `You are a professional AI Accountant, proficient with QuickBooks, working for a farm in Sierra Leone.
Your task is to generate a formal, audited financial record that can be sent to relevant authorities.
Based on the following transaction data, create a comprehensive report.

Transaction Data:
${transactionSummary}

The report should include:
1.  **Report Title:** Official Financial Statement for ${farmName}.
2.  **Date Range:** Covering the dates of the provided transactions.
3.  **Income Statement:** List all income transactions and calculate the total income.
4.  **Expense Breakdown:** List all expense transactions and calculate total expenses.
5.  **Profit/Loss Summary:** Clearly state the Net Profit or Loss.
6.  **Auditor's Note:** A concluding paragraph stating that the records have been automatically audited for accuracy based on the data provided.

Format the output cleanly and professionally as a formal business document. Do not use Markdown (e.g., no asterisks for bold, no dashes for lists). Use clear headings for each section. The currency is Sierra Leonean Leones (SLL).`;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setReport(response.text);
            addLog("Financial report generated successfully.");
        } catch (err) {
            console.error(err);
            setReportError("Failed to generate the financial report. Please try again.");
            addLog("Error: Report generation failed.");
        } finally { setLoadingReport(false); }
    };
    
    const handlePaySalaries = () => {
        alert("Simulating salary payment process. Check the activity log for details.");
        addLog("Monthly salaries paid to staff (Simulated).");
    };

    const handleAuditRecords = () => {
        addLog("Starting internal audit of financial records...");
        setTimeout(() => {
            addLog("Audit complete. All records are consistent.");
        }, 2000);
    };

    // --- HANDLERS & HELPERS from PaymentIntegrationsSubPage ---
    const getAccountIcon = (type: string) => {
        switch(type) {
            case 'Mobile Money': return 'fa-solid fa-mobile-screen-button';
            case 'Bank Account': return 'fa-solid fa-building-columns';
            case 'PayPal': return 'fa-brands fa-paypal';
            default: return 'fa-solid fa-credit-card';
        }
    };
    
    const getAccountInputDetails = () => {
        switch(accountType) {
            case 'Mobile Money': return { placeholder: 'e.g., 088 123 4567', label: 'Phone Number' };
            case 'Bank Account': return { placeholder: 'e.g., 1234567890', label: 'Account Number' };
            case 'PayPal': return { placeholder: 'e.g., farmer@email.com', label: 'PayPal Email' };
            default: return { placeholder: '', label: '' };
        }
    };

    const handleLinkAccount = (e: React.FormEvent) => {
        e.preventDefault();
        if (!provider.trim() || !identifier.trim()) {
            setLinkError('Provider and account details cannot be empty.');
            return;
        }
        setLinkError('');
        setLoadingLink(true);

        setTimeout(() => {
            const newAccount = {
                id: Date.now(),
                type: accountType,
                provider: provider.trim(),
                identifier: identifier.trim()
            };
            setLinkedAccounts(prev => [newAccount, ...prev]);
            setProvider('');
            setIdentifier('');
            setLoadingLink(false);
        }, 1500);
    };

    const handleRemoveAccount = (id: number) => {
        setLinkedAccounts(prev => prev.filter(acc => acc.id !== id));
    };
    
    const accountInputDetails = getAccountInputDetails();

    // --- NEW HANDLERS FOR BUSINESS PROFILE ---
    const handleSaveProfile = () => {
        localStorage.setItem('farmHubFarmName', farmName);
        localStorage.setItem('farmHubFarmAddress', farmAddress);
        alert('Profile saved successfully!');
    };

    // --- HANDLERS & HELPERS for Financial Document Template Generator ---
    const handleDocDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setDocData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const items = [...docData.items];
        items[index] = { ...items[index], [name]: name === 'description' ? value : parseFloat(value) || 0 };
        setDocData(prev => ({ ...prev, items }));
    };

    const addItem = () => {
        setDocData(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, price: 0 }] }));
    };

    const removeItem = (index: number) => {
        const items = docData.items.filter((_, i) => i !== index);
        setDocData(prev => ({ ...prev, items }));
    };

    const generatePreviewText = () => {
        let text = `**${docType.toUpperCase()}**\n\n`;
        text += `**From:**\n${docData.from}\n\n`;
        text += `**To:**\n${docData.to || '[Client Details]'}\n\n`;
        text += `**Date:** ${new Date().toLocaleDateString('en-CA')}\n\n`;
        text += `--- ITEMS ---\n`;
        docData.items.forEach(item => {
            text += `${item.description} (x${item.quantity}) @ ${formatCurrency(item.price)} each: ${formatCurrency(item.quantity * item.price)}\n`;
        });
        text += `----------------\n`;
        text += `**Subtotal:** ${formatCurrency(subtotal)}\n`;
        if (docData.taxRate > 0) {
            text += `**Tax (${docData.taxRate}%):** ${formatCurrency(taxAmount)}\n`;
        }
        text += `**GRAND TOTAL: ${formatCurrency(grandTotal)}**\n\n`;
        text += `**Notes:**\n${docData.notes}`;
        return text;
    };
    
    const handleDownloadPDFDoc = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = margin;

        const addContent = () => {
            doc.setFontSize(18).setFont(undefined, 'bold');
            doc.text(docType.toUpperCase(), pageWidth / 2, y, { align: 'center' });
            y += 15;
            
            doc.setFontSize(10).setFont(undefined, 'normal');
            doc.text(`Date: ${new Date().toLocaleDateString('en-CA')}`, pageWidth - margin, y, { align: 'right' });
            y += 10;
            
            const fromText = `${farmName}\n${farmAddress}`;
            const splitFrom = doc.splitTextToSize(fromText, (pageWidth/2) - margin - 5);
            const splitTo = doc.splitTextToSize(docData.to, (pageWidth/2) - margin - 5);
            doc.setFontSize(12).setFont(undefined, 'bold');
            doc.text('FROM:', margin, y);
            doc.text('TO:', pageWidth / 2, y);
            doc.setFontSize(10).setFont(undefined, 'normal');
            y += 6;
            doc.text(splitFrom, margin, y);
            doc.text(splitTo, pageWidth / 2, y);
            y += (Math.max(splitFrom.length, splitTo.length) * 5) + 10;

            doc.autoTable({
                startY: y,
                head: [['Description', 'Quantity', 'Unit Price', 'Total']],
                body: docData.items.map(item => [item.description, item.quantity, formatCurrency(item.price), formatCurrency(item.price * item.quantity)]),
                theme: 'striped',
                headStyles: { fillColor: [156, 176, 77] }, // --primary-green
            });
            
            y = doc.lastAutoTable.finalY + 10;

            const totalsX = pageWidth - margin;
            doc.setFontSize(12);
            doc.text(`Subtotal: ${formatCurrency(subtotal)}`, totalsX, y, { align: 'right' });
            y += 7;
             if (docData.taxRate > 0) {
                doc.text(`Tax (${docData.taxRate}%): ${formatCurrency(taxAmount)}`, totalsX, y, { align: 'right' });
                y += 7;
            }
            doc.setFont(undefined, 'bold');
            doc.text(`Total: ${formatCurrency(grandTotal)}`, totalsX, y, { align: 'right' });
            y += 15;
            
            doc.setFontSize(10).setFont(undefined, 'normal');
            doc.text('Notes:', margin, y);
            y+= 5;
            doc.text(doc.splitTextToSize(docData.notes, pageWidth - margin*2), margin, y);

            doc.save(`${docType.replace(' ', '_')}.pdf`);
        }

        if (logo) {
            const img = new Image();
            img.src = logo;
            img.onload = () => {
                try {
                    const mimeType = logo.substring(logo.indexOf(":") + 1, logo.indexOf(";"));
                    const format = mimeType.split('/')[1].toUpperCase();
                    const imgWidth = 30;
                    const imgHeight = (img.height * imgWidth) / img.width;
                    doc.addImage(logo, format, margin, y, imgWidth, imgHeight);
                    y += imgHeight + 10;
                } catch (e) {
                    console.error("Error adding image to PDF", e);
                } finally {
                    addContent();
                }
            };
            img.onerror = () => {
                console.error("Could not load image for PDF");
                addContent();
            };
        } else {
            addContent();
        }
    };

    const handleDownloadWordDoc = () => {
        const itemsHtml = docData.items.map(item => `
            <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.quantity * item.price)}</td>
            </tr>
        `).join('');

        const logoHtml = logo ? `<img src="${logo}" alt="Farm Logo" style="max-width: 150px; height: auto;" /><br/><br/>` : '';

        const htmlContent = `
            <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${docType}</title>
            <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .totals { text-align: right; }
            </style>
            </head><body>
            ${logoHtml}
            <h1>${docType.toUpperCase()}</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-CA')}</p>
            <p><strong>From:</strong><br/>${docData.from.replace(/\n/g, '<br/>')}</p>
            <p><strong>To:</strong><br/>${docData.to.replace(/\n/g, '<br/>')}</p>
            <table>
                <thead><tr><th>Description</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <p class="totals"><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
            ${docData.taxRate > 0 ? `<p class="totals"><strong>Tax (${docData.taxRate}%):</strong> ${formatCurrency(taxAmount)}</p>` : ''}
            <p class="totals"><strong>Total:</strong> ${formatCurrency(grandTotal)}</p>
            <p><strong>Notes:</strong><br/>${docData.notes.replace(/\n/g, '<br/>')}</p>
            </body></html>
        `;
        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${docType.replace(' ', '_')}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    return (
        <>
            {/* --- New Business Profile Section --- */}
            <div className="card">
                <h3>Business Profile</h3>
                <p className="card-subtitle">Set your farm's logo and details for documents.</p>
                <div className="profile-form">
                    <div className="logo-uploader">
                        <label>Farm Logo</label>
                        <input type="file" id="logo-upload" accept="image/*" onChange={onLogoChange} style={{display: 'none'}} />
                        <label htmlFor="logo-upload" className="file-input-label logo-upload-label">
                            {logo ? <img src={logo} alt="Farm Logo" className="logo-preview" /> : <span><i className="fa-solid fa-image"></i> Upload Logo</span>}
                        </label>
                    </div>
                    <div className="profile-details-inputs">
                        <label htmlFor="farm-name">Farm Name</label>
                        <input id="farm-name" type="text" className="input" value={farmName} onChange={e => setFarmName(e.target.value)} />
                        <label htmlFor="farm-address">Farm Address</label>
                        <textarea id="farm-address" className="textarea small" value={farmAddress} onChange={e => setFarmAddress(e.target.value)}></textarea>
                    </div>
                </div>
                <button className="button" onClick={handleSaveProfile}>Save Profile</button>
            </div>

            {/* --- Section from FinanceSubPage --- */}
            <div className="summary-grid">
                <div className="summary-card income"><h4>Total Income</h4><p>{formatCurrency(totalIncome)}</p><i className="fa-solid fa-arrow-up"></i></div>
                <div className="summary-card expense"><h4>Total Expenses</h4><p>{formatCurrency(totalExpenses)}</p><i className="fa-solid fa-arrow-down"></i></div>
                <div className={`summary-card profit ${netProfit < 0 ? 'loss' : ''}`}><h4>Net Profit</h4><p>{formatCurrency(netProfit)}</p><i className="fa-solid fa-scale-balanced"></i></div>
            </div>
            <div className="card">
                <h3>AI Financial Advisor</h3>
                <p className="card-subtitle">Ask questions about your farm's finances.</p>
                <form className="financial-advisor-form" onSubmit={handleAskFinancialAdvisor}>
                    <input type="text" className="input" placeholder="e.g., How can I reduce my fuel costs?"
                        value={financialQuery} onChange={e => setFinancialQuery(e.target.value)} disabled={loadingTip} />
                    <button type="submit" className="button" disabled={loadingTip || !financialQuery.trim()}>
                        {loadingTip ? "Thinking..." : "Ask AI"}
                    </button>
                </form>
                {loadingTip && <Loader text="Analyzing your finances..." />}
                {error && <p className="error-text">{error}</p>}
                {financialTip && <div className="result-box">{financialTip}</div>}
            </div>
            <div className="card">
                <h3>Manage Transactions</h3>
                <div className="actions-container">
                    <button className="button income-btn" onClick={() => handleOpenForm('income')}><i className="fa-solid fa-plus"></i> Add Income</button>
                    <button className="button expense-btn" onClick={() => handleOpenForm('expense')}><i className="fa-solid fa-minus"></i> Add Expense</button>
                </div>
                {showForm && (
                    <form className="add-transaction-form" onSubmit={handleAddTransaction}>
                        <h4>New {formType === 'income' ? 'Income' : 'Expense'}</h4>
                        <input type="text" className="input" placeholder="Description (e.g., Sold cassava)" value={description} onChange={e => setDescription(e.target.value)} required />
                        <input type="number" className="input" placeholder="Amount (SLL)" value={amount} onChange={e => setAmount(e.target.value)} required />
                        <div className="form-actions"><button type="button" className="button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="button">Save</button></div>
                    </form>
                )}
            </div>
            <div className="card">
                <h3>Recent Transactions</h3>
                <ul className="transaction-list">
                    {transactions.length === 0 ? <p style={{color: 'var(--text-light)'}}>No transactions recorded yet.</p> :
                        transactions.map(t => (
                            <li key={t.id} className="transaction-item">
                                <div className={`transaction-icon ${t.type}`}><i className={`fa-solid ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i></div>
                                <div className="transaction-details"><span className="transaction-desc">{t.description}</span><span className="transaction-date">{t.date}</span></div>
                                <span className={`transaction-amount ${t.type}`}>{t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}</span>
                            </li>
                        ))}
                </ul>
            </div>

            {/* --- Section for Financial Document Generator --- */}
            <div className="card">
                <h3>Financial Document Generator</h3>
                <p className="card-subtitle">Use templates to create quotes, invoices, and purchase orders.</p>
                <fieldset className="doc-gen-fieldset">
                    <legend>Document Details</legend>
                    <label>Document Type</label>
                    <select className="input" value={docType} onChange={e => setDocType(e.target.value)}>
                        <option>Invoice</option>
                        <option>Quote</option>
                        <option>Purchase Order</option>
                    </select>

                    <label>From</label>
                    <textarea className="textarea small" name="from" value={docData.from} readOnly></textarea>
                    
                    <label>To (Client Details)</label>
                    <textarea className="textarea small" name="to" placeholder="Client Name&#10;Client Address" value={docData.to} onChange={handleDocDataChange}></textarea>
                </fieldset>

                <fieldset className="doc-gen-fieldset">
                    <legend>Items</legend>
                    {docData.items.map((item, index) => (
                        <div key={index} className="item-row">
                            <input type="text" name="description" className="input" placeholder="Item Description" value={item.description} onChange={e => handleItemChange(index, e)} />
                            <div className="item-inputs">
                                <input type="number" name="quantity" className="input" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(index, e)} />
                                <input type="number" name="price" className="input" placeholder="Price" value={item.price} onChange={e => handleItemChange(index, e)} />
                                <button className="remove-item-btn" onClick={() => removeItem(index)}>&times;</button>
                            </div>
                        </div>
                    ))}
                    <button className="button-secondary" onClick={addItem}><i className="fa-solid fa-plus"></i> Add Item</button>
                </fieldset>

                <fieldset className="doc-gen-fieldset">
                    <legend>Summary & Notes</legend>
                     <label>Tax Rate (%)</label>
                    <input type="number" name="taxRate" className="input" placeholder="e.g., 15 for 15%" value={docData.taxRate} onChange={handleDocDataChange} />
                    
                    <div className="doc-totals">
                        <p>Subtotal: <span>{formatCurrency(subtotal)}</span></p>
                        <p>Tax: <span>{formatCurrency(taxAmount)}</span></p>
                        <p><strong>Total:</strong> <strong>{formatCurrency(grandTotal)}</strong></p>
                    </div>

                    <label>Notes / Terms</label>
                    <textarea className="textarea small" name="notes" value={docData.notes} onChange={handleDocDataChange}></textarea>
                </fieldset>
                
                <button className="button" onClick={() => setShowPreview(!showPreview)}>{showPreview ? 'Hide Preview' : 'Preview & Download'}</button>
                
                {showPreview && (
                    <div className="card" style={{marginTop: '20px'}}>
                        <h3>{docType} Preview</h3>
                        <div className="result-box">{generatePreviewText()}</div>
                        <div className="result-actions">
                            <button className="button-secondary" onClick={handleDownloadPDFDoc}>
                                <i className="fa-solid fa-file-pdf"></i> Download PDF
                            </button>
                            <button className="button" onClick={handleDownloadWordDoc}>
                                <i className="fa-solid fa-file-word"></i> Download Word
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- Section from AccountantSubPage --- */}
            <div className="summary-grid" style={{marginTop: '20px'}}>
                <div className="summary-card"><h4>Bank Balance</h4><p>{formatCurrency(58430000)}</p><i className="fa-solid fa-building-columns"></i></div>
                <div className="summary-card"><h4>Salaries Paid</h4><p>{formatCurrency(8500000)}</p><i className="fa-solid fa-money-bill-wave"></i></div>
                <div className="summary-card"><h4>Next Tax Filing</h4><p>Q4 2024</p><i className="fa-solid fa-calendar-check"></i></div>
            </div>
             <div className="card">
                <h3>AI Accountant</h3>
                <p className="card-subtitle">Perform automated accounting tasks.</p>
                <div className="actions-container vertical">
                    <button className="button" onClick={handleGenerateReport} disabled={loadingReport}><i className="fa-solid fa-file-invoice-dollar"></i> Generate Financial Report</button>
                    <button className="button button-secondary" onClick={handlePaySalaries} disabled={loadingReport}><i className="fa-solid fa-users"></i> Pay Monthly Salaries</button>
                    <button className="button button-secondary" onClick={handleAuditRecords} disabled={loadingReport}><i className="fa-solid fa-magnifying-glass-chart"></i> Audit Records</button>
                </div>
            </div>
             <div className="card">
                <h3>AI Activity Log</h3>
                <ul className="activity-log-list">
                    {activityLog.map(log => (
                        <li key={log.id} className="activity-log-item">
                            <i className="fa-solid fa-robot"></i>
                            <div className="activity-details">
                                <p>{log.text}</p>
                                <span>{log.time}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            {loadingReport && <Loader text="AI Accountant is working..." />}
            {reportError && <p className="error-text">{reportError}</p>}
            {report && (
                <div className="card">
                    <h3>Generated Financial Report</h3>
                    <div className="result-box">{report}</div>
                     <div className="result-actions">
                        <button className="button-secondary" onClick={() => downloadAsPdf(report, 'Financial_Report.pdf')}>
                            <i className="fa-solid fa-file-pdf"></i> Download PDF
                        </button>
                        <button className="button" onClick={() => downloadAsWord(report, 'Financial_Report.doc')}>
                            <i className="fa-solid fa-file-word"></i> Download Word
                        </button>
                    </div>
                </div>
            )}
            
            {/* --- Section from PaymentIntegrationsSubPage --- */}
            <div className="card" style={{marginTop: '20px'}}>
                <h3>Payment Integrations</h3>
                <p className="card-subtitle">Connect your bank or mobile money accounts to get paid.</p>
                <form onSubmit={handleLinkAccount}>
                    <label htmlFor="account-type">Payment System Type</label>
                    <select id="account-type" className="input" value={accountType} onChange={e => setAccountType(e.target.value)}>
                        <option>Mobile Money</option>
                        <option>Bank Account</option>
                        <option>PayPal</option>
                    </select>
                    
                    <label htmlFor="provider-name">Provider Name</label>
                    <input id="provider-name" type="text" className="input"
                        placeholder={accountType === 'Bank Account' ? 'e.g., Rokel Commercial Bank' : 'e.g., Orange Money'}
                        value={provider} onChange={e => setProvider(e.target.value)} required />
                    
                    <label htmlFor="account-identifier">{accountInputDetails.label}</label>
                     <input id="account-identifier" type={accountType === 'PayPal' ? 'email' : 'text'} className="input"
                        placeholder={accountInputDetails.placeholder} value={identifier} onChange={e => setIdentifier(e.target.value)} required />
                    
                    {linkError && <p className="error-text">{linkError}</p>}
                    <button type="submit" className="button" disabled={loadingLink}>
                        {loadingLink ? 'Linking...' : 'Link Account'}
                    </button>
                </form>
            </div>
            <div className="card">
                <h3>Linked Accounts</h3>
                {linkedAccounts.length === 0 ? (
                    <p style={{color: 'var(--text-light)'}}>No payment methods linked yet.</p>
                ) : (
                    <ul className="linked-account-list">
                        {linkedAccounts.map(acc => (
                            <li key={acc.id} className="linked-account-item">
                                <div className="account-icon-wrapper"><i className={getAccountIcon(acc.type)}></i></div>
                                <div className="account-info">
                                    <strong>{acc.provider}</strong>
                                    <span>{acc.type} &bull; **** {acc.identifier.slice(-4)}</span>
                                </div>
                                <button onClick={() => handleRemoveAccount(acc.id)} className="remove-account-btn" aria-label={`Remove ${acc.provider} account`}>
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
};

const AdminDocsSubPage = () => {
    const [docType, setDocType] = useState('Business Plan');
    const [details, setDetails] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        if (!details) {
            setError('Please provide some details for the document.');
            return;
        }
        setLoading(true);
        setError('');
        setResult('');
        try {
            const prompt = `You are an expert administrative assistant for an agricultural business in Sierra Leone.
Generate a formal and well-structured "${docType}".
The document should be based on the following key points provided by the user:
"${details}"

Structure the output professionally as a formal business document with clear headings and paragraphs. Do not use Markdown formatting (e.g., no asterisks for bolding). Tailor the content to be relevant for a small-to-medium scale agribusiness in West Africa.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setResult(response.text);
        } catch (err) {
            console.error(err);
            setError("Failed to generate the document. Please try again.");
        } finally { setLoading(false); }
    };

    return (
        <div className="card">
            <h3>AI Document Generator</h3>
            <p className="card-subtitle">Create professional documents for your farm business.</p>
            <label htmlFor="doc-type-select">Document Type</label>
            <select id="doc-type-select" className="input" value={docType} onChange={e => setDocType(e.target.value)}>
                <option>Business Plan</option>
                <option>Grant Proposal</option>
                <option>Official Letter</option>
                <option>Marketing Copy</option>
            </select>
            <label htmlFor="doc-details">Key Points to Include</label>
            <textarea id="doc-details" className="textarea" placeholder="e.g., For a business plan, list your goals, products, and target market..." value={details} onChange={e => setDetails(e.target.value)}></textarea>
            <button className="button" onClick={handleGenerate} disabled={loading}>{loading ? "Generating..." : "Generate Document"}</button>
            {loading && <Loader text="Generating document..." />}
            {error && <p className="error-text">{error}</p>}
            {result && (
                <div className="card" style={{marginTop: '20px'}}>
                    <h3>Generated Document</h3>
                    <div className="result-box">{result}</div>
                    <div className="result-actions">
                        <button className="button-secondary" onClick={() => downloadAsPdf(result, `${docType.replace(/ /g, '_')}.pdf`)}>
                            <i className="fa-solid fa-file-pdf"></i> Download PDF
                        </button>
                        <button className="button" onClick={() => downloadAsWord(result, `${docType.replace(/ /g, '_')}.doc`)}>
                            <i className="fa-solid fa-file-word"></i> Download Word
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const HRSubPage = ({ addCommunityPost }: { addCommunityPost: (post: any) => void }) => {
    const [jobTitle, setJobTitle] = useState('');
    const [responsibilities, setResponsibilities] = useState('');
    const [skills, setSkills] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [generationType, setGenerationType] = useState('');
    const [postSuccess, setPostSuccess] = useState(false);
    
    const handleGenerate = async (type: string) => {
        if (!jobTitle) {
            setError('Please enter a job title.');
            return;
        }
        setGenerationType(type);
        setLoading(true);
        setError('');
        setResult('');
        setPostSuccess(false);

        try {
            const prompt = `You are an HR consultant for farms in Sierra Leone.
Task: Generate a "${type}" for the following position:
- Job Title: "${jobTitle}"
- Key Responsibilities: "${responsibilities || 'Not specified'}"
- Required Skills: "${skills || 'Not specified'}"

Provide a professional, well-structured response suitable for a formal document. Do not use Markdown formatting. For an Offer Letter, create a standard template with placeholders like [Candidate Name] and [Salary]. For a Job Description, make it appealing to potential candidates.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setResult(response.text);
        } catch (err) {
            console.error(err);
            setError(`Failed to generate the ${type}. Please try again.`);
        } finally { setLoading(false); }
    };

    const handlePostToCommunity = () => {
        const newPost = {
            author: "FarmHuub HR",
            avatar: "HR",
            content: `**📢 JOB OPENING: ${jobTitle}**\n\n${result}`,
            image: false
        };
        addCommunityPost(newPost);
        setPostSuccess(true);
    };

    const handleShare = async () => {
        if (!navigator.share) {
            alert('Share feature is not supported on your browser.');
            return;
        }
        try {
            await navigator.share({
                title: `Job Opening: ${jobTitle}`,
                text: result,
            });
        } catch (error) {
            console.error('Error sharing document:', error);
        }
    };
    
    return (
        <>
            <div className="card">
                <h3>HR Helper</h3>
                <p className="card-subtitle">Generate documents to help you hire the best staff.</p>
                <label htmlFor="job-title">Job Title</label>
                <input id="job-title" type="text" className="input" placeholder="e.g., Farm Manager" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
                <label htmlFor="job-responsibilities">Key Responsibilities (optional)</label>
                <textarea id="job-responsibilities" className="textarea" placeholder="e.g., Manage crop cycles, supervise staff..." value={responsibilities} onChange={e => setResponsibilities(e.target.value)}></textarea>
                <label htmlFor="job-skills">Required Skills (optional)</label>
                <input id="job-skills" type="text" className="input" placeholder="e.g., Knowledge of cassava, leadership" value={skills} onChange={e => setSkills(e.target.value)} />

                <div className="actions-container">
                    <button className="button" onClick={() => handleGenerate('Job Description')} disabled={loading || !jobTitle}>Job Description</button>
                    <button className="button" onClick={() => handleGenerate('Interview Questions')} disabled={loading || !jobTitle}>Interview Qs</button>
                    <button className="button" onClick={() => handleGenerate('Offer Letter')} disabled={loading || !jobTitle}>Offer Letter</button>
                </div>
            </div>
            {loading && <Loader text={`Generating ${generationType}...`} />}
            {error && <p className="error-text">{error}</p>}
            {result && (
                <div className="card">
                    <h3>Generated {generationType}</h3>
                    <div className="result-box">{result}</div>
                    <div className="result-actions">
                         <button className="button-secondary" onClick={() => downloadAsPdf(result, `${generationType.replace(/ /g, '_')}.pdf`)}>
                            <i className="fa-solid fa-file-pdf"></i> PDF
                         </button>
                         <button className="button-secondary" onClick={() => downloadAsWord(result, `${generationType.replace(/ /g, '_')}.doc`)}>
                            <i className="fa-solid fa-file-word"></i> Word
                         </button>
                         {generationType === 'Job Description' && (
                            <>
                                {navigator.share && (
                                    <button className="button-secondary" onClick={handleShare}>
                                        <i className="fa-solid fa-share-nodes"></i> Share
                                    </button>
                                )}
                                <button className="button" onClick={handlePostToCommunity}>
                                    <i className="fa-solid fa-bullhorn"></i> Post to Feed
                                </button>
                            </>
                         )}
                    </div>
                    {postSuccess && <p className="success-text">Successfully posted to the community feed!</p>}
                </div>
            )}
        </>
    );
};

const LegalAidSubPage = () => {
    const [docType, setDocType] = useState('Land Lease Agreement');
    const [details, setDetails] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        if (!details) {
            setError('Please provide key details for the agreement.');
            return;
        }
        setLoading(true);
        setError('');
        setResult('');
        try {
            const prompt = `You are an AI legal assistant for agribusinesses in Sierra Leone. Your goal is to generate draft legal documents. You are NOT a licensed lawyer and your output is NOT a substitute for professional legal advice.
ALWAYS begin your response with this exact disclaimer in bold:
**DISCLAIMER: This is an AI-generated document and not a substitute for professional legal advice from a qualified lawyer. The user assumes all risk and responsibility for its use.**

Now, generate a standard "${docType}" based on these user-provided details:
"${details}"

The document should be formal, comprehensive, and include common clauses relevant to Sierra Leone. Do not use Markdown formatting. Use placeholders like [Name/Date/Location] for information that should be filled in manually.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setResult(response.text);
        } catch (err) {
            console.error(err);
            setError("Failed to generate the document. Please try again.");
        } finally { setLoading(false); }
    };

    return (
        <>
            <div className="card legal-disclaimer">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <div>
                    <h4>Legal Notice</h4>
                    <p>The AI-generated documents are for informational purposes only and are not a substitute for advice from a licensed lawyer. Always consult with a legal professional for serious matters.</p>
                </div>
            </div>
            <div className="card">
                <h3>AI Legal Aid</h3>
                <p className="card-subtitle">Create draft legal agreements for your business.</p>
                <label htmlFor="legal-doc-type">Document Type</label>
                <select id="legal-doc-type" className="input" value={docType} onChange={e => setDocType(e.target.value)}>
                    <option>Land Lease Agreement</option>
                    <option>Partnership Agreement</option>
                    <option>Sales Contract</option>
                    <option>Non-Disclosure Agreement (NDA)</option>
                    <option>Employment Contract</option>
                </select>
                <label htmlFor="legal-details">Key Details</label>
                <textarea id="legal-details" className="textarea" placeholder="e.g., Names of parties, land location and size, lease duration, payment terms..." value={details} onChange={e => setDetails(e.target.value)}></textarea>
                <button className="button" onClick={handleGenerate} disabled={loading}>{loading ? "Generating..." : "Generate Agreement"}</button>
            </div>
            {loading && <Loader text="Generating legal document..." />}
            {error && <p className="error-text">{error}</p>}
            {result && (
                <div className="card">
                    <h3>Generated {docType}</h3>
                    <div className="result-box">{result}</div>
                    <div className="result-actions">
                        <button className="button-secondary" onClick={() => downloadAsPdf(result, `${docType.replace(/ /g, '_')}.pdf`)}>
                            <i className="fa-solid fa-file-pdf"></i> Download PDF
                        </button>
                        <button className="button" onClick={() => downloadAsWord(result, `${docType.replace(/ /g, '_')}.doc`)}>
                            <i className="fa-solid fa-file-word"></i> Download Word
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

const FarmAdminPage = ({ addCommunityPost, logo, onLogoChange }: { addCommunityPost: (post: any) => void; logo: string | null; onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }) => {
  const [activeSubTab, setActiveSubTab] = useState('finance');

  const renderSubPage = () => {
    switch (activeSubTab) {
      case 'finance': return <FinanceSubPage logo={logo} onLogoChange={onLogoChange} />;
      case 'docs': return <AdminDocsSubPage />;
      case 'hr': return <HRSubPage addCommunityPost={addCommunityPost} />;
      case 'legal': return <LegalAidSubPage />;
      default: return <FinanceSubPage logo={logo} onLogoChange={onLogoChange} />;
    }
  };

  const tabs = [
    { id: 'finance', label: 'Finance', icon: 'fa-solid fa-sack-dollar' },
    { id: 'docs', label: 'Docs', icon: 'fa-solid fa-file-alt' },
    { id: 'hr', label: 'HR', icon: 'fa-solid fa-users-gear' },
    { id: 'legal', label: 'Legal', icon: 'fa-solid fa-gavel' },
  ];

  return (
    <div>
      <h2>Farm Admin Hub</h2>
      <div className="sub-nav">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`sub-nav-button ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            <i className={tab.icon}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="sub-page-content">
        {renderSubPage()}
      </div>
    </div>
  );
};

// --- NEW CLIMATE PAGE ---
const ClimatePage = ({ 
    userTier, language, setLanguage, 
    selectedCountry, setSelectedCountry, availableLanguages, countryName
} : { 
    userTier: 'free' | 'premium', language: string; setLanguage: (l: string) => void; 
    selectedCountry: string; setSelectedCountry: (c: string) => void;
    availableLanguages: any[]; countryName: string;
}) => {
  const [activeSubTab, setActiveSubTab] = useState('weather');

  const renderSubPage = () => {
    switch (activeSubTab) {
      case 'weather': return <WeatherSubPage language={language} countryName={countryName} />;
      case 'wastelands': return <WastelandsSubPage language={language} countryName={countryName} />;
      case 'updates': return <UpdatesSubPage language={language} countryName={countryName} />;
      case 'grants': return <GrantsSubPage userTier={userTier} language={language} countryName={countryName} />;
      default: return <WeatherSubPage language={language} countryName={countryName} />;
    }
  };
  
  const tabs = [
    { id: 'weather', label: 'Weather', icon: 'fa-solid fa-cloud-sun' },
    { id: 'wastelands', label: 'Wastelands', icon: 'fa-solid fa-skull-crossbones' },
    { id: 'updates', label: 'Updates', icon: 'fa-solid fa-newspaper' },
    { id: 'grants', label: 'Grants', icon: 'fa-solid fa-hand-holding-dollar' },
  ];

  return (
    <div>
      <h2>Climate Hub</h2>
      <SettingsBar 
            selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry}
            availableLanguages={availableLanguages} language={language} setLanguage={setLanguage}
      />
      <div className="sub-nav">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`sub-nav-button ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            <i className={tab.icon}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="sub-page-content">
        {renderSubPage()}
      </div>
    </div>
  );
};

const WeatherSubPage = ({ language, countryName }: { language: string, countryName: string }) => {
    const [location, setLocation] = useState(countryName);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [period, setPeriod] = useState('');
    
    useEffect(() => {
        setLocation(countryName);
    }, [countryName]);

    const handleGetAdvice = async (timeframe: string) => {
        if (!location) {
            setError('Please enter a location.');
            return;
        }
        setLoading(true);
        setResult('');
        setError('');
        setPeriod(timeframe);

        try {
            const langName = countries.flatMap(c => c.languages).find(l => l.code === language)?.name || 'English';
            const prompt = `You are a climate and agriculture expert for ${countryName}.
Generate a plausible weather forecast and actionable farming advice for **${location}** for the following period: **${timeframe}**.

The advice must be specific, practical, and tailored to crops commonly grown in ${countryName}.
For example, if there's high heat, suggest specific irrigation or mulching techniques. If there's heavy rain, advise on drainage and disease prevention.

Format the response clearly with a "Weather Outlook" section and a "Farming Advisory" section.
Respond in ${langName}.
`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setResult(response.text);
        } catch (err) {
            console.error(err);
            setError("Failed to generate weather advisory. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="card">
                <h3>Weather Advisory</h3>
                <p className="card-subtitle">Get AI-powered weather advice for your farm.</p>
                <label htmlFor="location-input">Location</label>
                <input id="location-input" type="text" className="input" value={location} onChange={e => setLocation(e.target.value)} />
                <div className="actions-container">
                    <button className="button-secondary" onClick={() => handleGetAdvice('Today')} disabled={loading}>Today</button>
                    <button className="button-secondary" onClick={() => handleGetAdvice('This Week')} disabled={loading}>This Week</button>
                    <button className="button-secondary" onClick={() => handleGetAdvice('This Month')} disabled={loading}>This Month</button>
                </div>
            </div>
            {loading && <Loader text={`Generating advisory for ${period}...`} />}
            {error && <p className="error-text">{error}</p>}
            {result && (
                <div className="card">
                    <h3>{period} Advisory for {location}</h3>
                    <div className="result-box">{result}</div>
                    <div className="result-actions">
                        <button className="button-secondary" onClick={() => downloadAsPdf(result, `Weather_Advisory_${period}.pdf`)}>
                            <i className="fa-solid fa-file-pdf"></i> Download PDF
                        </button>
                        <button className="button" onClick={() => downloadAsWord(result, `Weather_Advisory_${period}.doc`)}>
                            <i className="fa-solid fa-file-word"></i> Download Word
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

const WastelandsSubPage = ({ language, countryName }: { language: string, countryName: string }) => {
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [selectedSite, setSelectedSite] = useState<{name: string, type: string} | null>(null);

    const miningHotspots = [
        { name: 'Koidu', type: 'Diamond', coords: [8.633, -10.767] },
        { name: 'Marampa', type: 'Iron Ore', coords: [8.717, -12.967] },
        { name: 'Sierra Rutile Mine', type: 'Titanium', coords: [7.883, -12.7] },
    ];

    useEffect(() => {
        if (typeof L === 'undefined' || !mapContainerRef.current || mapRef.current) return;
        
        const map = L.map(mapContainerRef.current).setView([8.4844, -13.2344], 8);
        L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(map);

        miningHotspots.forEach(site => {
            const marker = L.marker(site.coords).addTo(map);
            const popupContent = `
                <b>${site.name}</b><br/>
                Former ${site.type} Mining Area<br/>
                <button id="analyze-${site.name.replace(' ', '')}" class="button" style="width:100%; margin-top:10px; padding:8px;">Analyze Site</button>
            `;
            marker.bindPopup(popupContent);
        });

        map.on('popupopen', (e: any) => {
            const popupNode = e.popup.getElement();
            const analyzeButton = popupNode.querySelector('button');
            if (analyzeButton) {
                const siteName = analyzeButton.id.replace('analyze-', '');
                const site = miningHotspots.find(s => s.name.replace(' ', '') === siteName);
                if (site) {
                    analyzeButton.onclick = () => handleAnalyze(site);
                }
            }
        });
        
        mapRef.current = map;
        return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    }, []);

    const handleAnalyze = async (site: { name: string, type: string }) => {
        setLoading(true);
        setResult('');
        setError('');
        setSelectedSite(site);
        if (mapRef.current) mapRef.current.closePopup();

        try {
            const langName = countries.flatMap(c => c.languages).find(l => l.code === language)?.name || 'English';
            const prompt = `You are an expert in land reclamation and soil science, specializing in post-mining environments in West Africa, particularly ${countryName}.
The selected location is a former **${site.type}** mining site near **${site.name}**. The land is currently barren and considered a wasteland.
Provide a detailed, step-by-step reclamation plan to make this land useful for agriculture again. The plan should be practical for local communities.

Include the following sections:
1.  **Initial Site Assessment:** Simple techniques to analyze soil toxicity and composition.
2.  **Soil Amendment Strategy:** Recommendations for detoxification and enrichment using locally available materials (e.g., biochar, compost, specific manures).
3.  **Pioneer Species Planting:** Suggest hardy, nitrogen-fixing pioneer plants native to the region that can stabilize the soil and begin building organic matter.
4.  **Phased Agricultural Introduction:** A long-term strategy for reintroducing food crops, starting with tolerant varieties and moving towards more sensitive ones.
5.  **Water Management:** Suggestions for rebuilding healthy water retention in the soil.
6.  **Estimated Timeline & Challenges:** A realistic outlook on the project duration and potential hurdles.

Respond in ${langName}.
`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setResult(response.text);
        } catch (err) {
            console.error(err);
            setError("Failed to generate reclamation plan. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="card">
                <h3>Wasteland Reclamation</h3>
                <p className="card-subtitle">Select a post-mining hotspot on the map to get an AI-generated reclamation plan.</p>
                <div className="map-container" ref={mapContainerRef}></div>
            </div>
            {loading && <Loader text={`Analyzing ${selectedSite?.name} site...`} />}
            {error && <p className="error-text">{error}</p>}
            {result && selectedSite && (
                <div className="card">
                    <h3>Reclamation Plan: {selectedSite.name}</h3>
                    <div className="result-box">{result}</div>
                    <div className="result-actions">
                        <button className="button-secondary" onClick={() => downloadAsPdf(result, `Reclamation_Plan_${selectedSite.name}.pdf`)}>
                            <i className="fa-solid fa-file-pdf"></i> Download PDF
                        </button>
                        <button className="button" onClick={() => downloadAsWord(result, `Reclamation_Plan_${selectedSite.name}.doc`)}>
                            <i className="fa-solid fa-file-word"></i> Download Word
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

const UpdatesSubPage = ({ language, countryName }: { language: string, countryName: string }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const handleGetUpdates = async () => {
        setLoading(true);
        setResult('');
        setError('');
        try {
            const langName = countries.flatMap(c => c.languages).find(l => l.code === language)?.name || 'English';
            const prompt = `You are an agricultural and climate news analyst. Provide a concise daily briefing on new trends and important updates regarding climate, agriculture, and food security relevant to ${countryName} and its region.
Include at least one global story and explain its local implications.
Format the output with clear, engaging headings for each news item.
Respond in ${langName}.
`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setResult(response.text);
        } catch (err) {
            console.error(err);
            setError("Failed to generate daily updates. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
         <>
            <div className="card">
                <h3>Daily Agri-Climate Updates</h3>
                <p className="card-subtitle">Get the latest news and trends affecting farming in your country and worldwide.</p>
                <button className="button" onClick={handleGetUpdates} disabled={loading}>
                    <i className="fa-solid fa-satellite-dish" style={{marginRight: '8px'}}></i>
                    {loading ? "Fetching Briefing..." : "Get Today's Briefing"}
                </button>
            </div>
            {loading && <Loader text="Compiling today's news..." />}
            {error && <p className="error-text">{error}</p>}
            {result && (
                <div className="card">
                    <h3>Today's Briefing</h3>
                    <div className="result-box">{result}</div>
                    <div className="result-actions">
                        <button className="button-secondary" onClick={() => downloadAsPdf(result, `Daily_Briefing.pdf`)}>
                            <i className="fa-solid fa-file-pdf"></i> Download PDF
                        </button>
                        <button className="button" onClick={() => downloadAsWord(result, `Daily_Briefing.doc`)}>
                            <i className="fa-solid fa-file-word"></i> Download Word
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

type Grant = { name: string; funder: string; focus: string; description: string };

const GrantsSubPage = ({ userTier, language, countryName }: { userTier: 'free' | 'premium', language: string, countryName: string }) => {
    const [vision, setVision] = useState('');
    const [loading, setLoading] = useState(false);
    const [grants, setGrants] = useState<Grant[]>([]);
    const [error, setError] = useState('');
    
    const [drafting, setDrafting] = useState(false);
    const [draft, setDraft] = useState('');
    const [draftError, setDraftError] = useState('');
    const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
    
    // New state for premium proposal builder
    const [showProposalBuilder, setShowProposalBuilder] = useState(false);
    const [budgetItems, setBudgetItems] = useState([{ description: '', amount: 0 }]);

    const totalBudget = budgetItems.reduce((sum, item) => sum + item.amount, 0);

    const handleFindGrants = async () => {
        if (!vision) {
            setError("Please describe your farm's vision and values.");
            return;
        }
        setLoading(true);
        setError('');
        setGrants([]);
        setDraft('');
        setShowProposalBuilder(false);

        try {
            const prompt = `You are a grant-finding assistant for agricultural businesses in ${countryName}. Based on the user's farm profile below, invent a list of 2 plausible, fictional grants that are a good match.

User's Farm Profile: "${vision}"

For each fictional grant, provide: Grant Name, Funder (a fictional organization), Focus Area, and a brief description.
Format the output as a JSON array of objects. Each object should have keys: "name", "funder", "focus", "description".
Example: [{"name": "...", "funder": "...", "focus": "...", "description": "..."}]
Do not include any text outside of the JSON array.
`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const jsonString = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedGrants = JSON.parse(jsonString);
            setGrants(parsedGrants);
        } catch (err) {
            console.error(err);
            setError("Failed to find grants. The AI's response might have been malformed. Please try again.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleSelectGrantForDrafting = (grant: Grant) => {
        if (userTier === 'free') {
            alert("This is a premium feature. Please upgrade to write detailed, professional grant proposals with budgets.");
            return;
        }
        setSelectedGrant(grant);
        setShowProposalBuilder(true);
        setDraft('');
        setBudgetItems([{ description: 'Project Management', amount: 0 }, { description: 'Materials & Supplies', amount: 0 }]);
    };
    
    const handleGenerateDetailedProposal = async () => {
        if (!selectedGrant) return;
        setDrafting(true);
        setDraft('');
        setDraftError('');

        try {
            const langName = countries.flatMap(c => c.languages).find(l => l.code === language)?.name || 'English';
            const prompt = `You are an expert grant writer with extensive experience in securing funding from major international organizations like USAID, the World Bank, and the Bill & Melinda Gates Foundation. Your specialty is agriculture in ${countryName}.

Your task is to draft a comprehensive, professional, and persuasive grant proposal based on the applicant's profile and the grant's details. The proposal must be detailed, well-structured, and at least 800 words long.

**Grant Details:**
- Grant Name: ${selectedGrant.name}
- Funder: ${selectedGrant.funder}
- Grant Focus: ${selectedGrant.focus}

**Applicant's Profile / Vision:**
"${vision}"

**Proposed Budget:**
${budgetItems.map(item => `- ${item.description}: ${formatCurrency(item.amount)}`).join('\n')}
Total Budget: ${formatCurrency(totalBudget)}

Please structure the proposal with the following sections, using clear headings (do not use Markdown formatting like asterisks or hashtags):

1.  **COVER LETTER:** A brief, formal introductory letter addressed to the funding organization.
2.  **EXECUTIVE SUMMARY:** A concise overview of the entire proposal, highlighting the problem, the proposed solution, key objectives, and the total funding requested.
3.  **INTRODUCTION & PROBLEM STATEMENT:** A detailed description of the agricultural challenges the applicant is addressing. Use plausible statistics and context relevant to ${countryName}. Explain why this project is necessary.
4.  **PROJECT GOALS AND OBJECTIVES:** Clearly define the primary goal of the project. List several specific, measurable, achievable, relevant, and time-bound (SMART) objectives.
5.  **METHODOLOGY & ACTIVITIES:** Describe the specific activities that will be undertaken to achieve the objectives. This should be a step-by-step plan of action.
6.  **MONITORING AND EVALUATION (M&E) PLAN:** Explain how the project's success will be tracked and measured. What are the key performance indicators (KPIs)?
7.  **DETAILED BUDGET NARRATIVE & TABLE:** First, provide a narrative explaining and justifying the costs. Then, present the budget in a clear, formatted table with columns for 'Item', 'Cost', and 'Justification'. Use the budget data provided above.
8.  **ORGANIZATIONAL BACKGROUND:** Briefly describe the applicant's organization (based on their profile), highlighting their capacity to successfully implement the project.
9.  **CONCLUSION:** A strong concluding paragraph that reiterates the project's importance and impact.

Respond in ${langName}. The tone should be professional, confident, and compelling.
`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setDraft(response.text);
            setShowProposalBuilder(false);
        } catch(err) {
            console.error(err);
            setDraftError("Failed to draft the application. Please try again.");
        } finally {
            setDrafting(false);
        }
    };
    
    // Budget helper functions
    const handleBudgetChange = (index: number, field: 'description' | 'amount', value: string | number) => {
        const newItems = [...budgetItems];
        const aValue = typeof value === 'string' ? parseFloat(value) : value;
        newItems[index] = { ...newItems[index], [field]: field === 'amount' ? aValue || 0 : value };
        setBudgetItems(newItems);
    };

    const addBudgetItem = () => {
        setBudgetItems([...budgetItems, { description: '', amount: 0 }]);
    };

    const removeBudgetItem = (index: number) => {
        if (budgetItems.length > 1) {
            setBudgetItems(budgetItems.filter((_, i) => i !== index));
        }
    };


    return (
        <>
            <div className="card">
                <h3>AI Grant Finder & Assistant</h3>
                <p className="card-subtitle">Describe your farm's mission to find matching grants and get help applying.</p>
                <label htmlFor="farm-vision">Your Farm's Vision & Values</label>
                <textarea id="farm-vision" className="textarea" placeholder="e.g., We are a women-led cooperative focused on organic cassava farming..." value={vision} onChange={e => setVision(e.target.value)}></textarea>
                <button className="button" onClick={handleFindGrants} disabled={loading}>
                    {loading ? "Searching..." : "Find Grants"}
                </button>
            </div>

            {loading && <Loader text="Searching for matching grants..." />}
            {error && <p className="error-text">{error}</p>}

            {grants.length > 0 && (
                <div className="card">
                    <h3>Matching Grant Opportunities</h3>
                    <div className="grants-list">
                        {grants.map((grant, index) => (
                            <div className="grant-card" key={index}>
                                <h4>{grant.name}</h4>
                                <p><strong>Funder:</strong> {grant.funder}<br/>
                                <strong>Focus:</strong> {grant.focus}<br/>
                                {grant.description}</p>
                                <button className="button" onClick={() => handleSelectGrantForDrafting(grant)} disabled={drafting}>
                                    Draft Application with AI
                                    {userTier === 'free' && <i className="fa-solid fa-lock" style={{marginLeft: '8px'}}></i>}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {userTier === 'premium' && showProposalBuilder && selectedGrant && (
                <div className="card proposal-builder-card">
                    <h3>Detailed Proposal Builder for: {selectedGrant.name}</h3>
                    <p className="card-subtitle">Create a budget for your proposal. The AI will use this to write a detailed narrative.</p>
                    
                    <div className="budget-form">
                        <div className="budget-header">
                            <span>Item Description</span>
                            <span>Amount (SLL)</span>
                        </div>
                        {budgetItems.map((item, index) => (
                            <div className="budget-item-row" key={index}>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Purchase of certified seeds"
                                    value={item.description}
                                    onChange={(e) => handleBudgetChange(index, 'description', e.target.value)}
                                />
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="e.g., 5000000"
                                    value={item.amount === 0 ? '' : item.amount}
                                    onChange={(e) => handleBudgetChange(index, 'amount', e.target.value)}
                                />
                                <button className="remove-item-btn" onClick={() => removeBudgetItem(index)} disabled={budgetItems.length <= 1}>&times;</button>
                            </div>
                        ))}
                         <button className="button-secondary" onClick={addBudgetItem} style={{width: 'auto', padding: '8px 15px'}}>
                            <i className="fa-solid fa-plus"></i> Add Line Item
                        </button>
                    </div>

                    <div className="budget-summary">
                        <strong>Total Budget:</strong>
                        <span>{formatCurrency(totalBudget)}</span>
                    </div>

                    <button className="button" onClick={handleGenerateDetailedProposal} disabled={drafting}>
                        {drafting ? 'Generating Proposal...' : 'Generate Detailed Proposal'}
                    </button>
                </div>
            )}
            
            {drafting && <Loader text={`Drafting professional proposal for ${selectedGrant?.name}...`} />}
            {draftError && <p className="error-text">{draftError}</p>}

            {draft && selectedGrant && (
                 <div className="card">
                    <h3>Generated Proposal for: {selectedGrant.name}</h3>
                    <div className="result-box">{draft}</div>
                     <div className="result-actions">
                        <button className="button-secondary" onClick={() => downloadAsPdf(draft, `Grant_Proposal_${selectedGrant.name}.pdf`)}>
                            <i className="fa-solid fa-file-pdf"></i> PDF
                        </button>
                        <button className="button" onClick={() => downloadAsWord(draft, `Grant_Proposal_${selectedGrant.name}.doc`)}>
                            <i className="fa-solid fa-file-word"></i> Word
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

// --- NEW CALL AGENT PAGE ---

// Call simulation UI
const LiveCallUI = ({ farmName, callData, onCallEnd }: { farmName: string, callData: any, onCallEnd: (log: any) => void }) => {
    const [status, setStatus] = useState('Connecting...');
    const [transcript, setTranscript] = useState<{ speaker: 'agent' | 'client'; text: string }[]>([]);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const chatRef = useRef<Chat | null>(null);
    const clientScript = useRef([
        "Hello, this is Fatu.",
        "Oh, hello. Yes, I have a moment. What is this about?",
        "Yes, that works for me. What time were you thinking?",
        "10 AM sounds perfect.",
        "Excellent. Thank you for calling. Goodbye."
    ]);
    const scriptIndex = useRef(0);
    
    const scheduleMeeting: FunctionDeclaration = {
      name: 'scheduleMeeting',
      parameters: {
        type: Type.OBJECT,
        description: 'Schedules a meeting with a client.',
        properties: {
          dateTime: { type: Type.STRING, description: 'The date and time of the meeting in ISO 8601 format.' },
          topic: { type: Type.STRING, description: 'The topic of the meeting.' },
          attendee: { type: Type.STRING, description: 'The name of the person attending the meeting.'},
        },
        required: ['dateTime', 'topic', 'attendee'],
      },
    };

    const addTranscript = (speaker: 'agent' | 'client', text: string) => {
        setTranscript(prev => [...prev, { speaker, text }]);
    };

    const endCall = (result: any) => {
        setStatus('Call Ended');
        const finalLog = {
            id: Date.now(),
            contact: callData.contact,
            objective: callData.objective,
            outcome: result,
            transcript: transcript,
        };
        setTimeout(() => onCallEnd(finalLog), 2000);
    };

    const processAIResponse = useCallback(async (message: string) => {
        if (!chatRef.current) return;
        
        // This function needs to be defined here to be in scope for the callback
        const handleClientResponse = async () => {
            if (!chatRef.current || scriptIndex.current >= clientScript.current.length) {
                endCall({ success: false, reason: "Client ended conversation." });
                return;
            }

            const clientMessage = clientScript.current[scriptIndex.current];
            scriptIndex.current++;
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            addTranscript('client', clientMessage);
            
            await processAIResponse(clientMessage);
        };

        let fullResponse = "";
        try {
            const stream = await chatRef.current.sendMessageStream({ message });
            let lastText = "";
            for await (const chunk of stream) {
                lastText = chunk.text; // Keep track of the latest text from the stream
                
                if(chunk.functionCalls && chunk.functionCalls.length > 0){
                    const fc = chunk.functionCalls[0];
                    if(fc.name === 'scheduleMeeting'){
                        const { dateTime, topic, attendee } = fc.args;
                        setStatus('Scheduling...');
                        addTranscript('agent', `[Function Call: Scheduling meeting for ${attendee} about "${topic}" at ${new Date(dateTime).toLocaleString()}]`);
                        
                        // "Execute" the function and send result back to model
                        const functionResponse = [{
                            functionCall: fc,
                            functionResponse: { name: 'scheduleMeeting', response: { result: "Meeting scheduled successfully." }}
                        }];
                        // We need a non-streaming call here to send back function result
                        const finalResponse = await chatRef.current.sendMessage({ message: JSON.stringify(functionResponse) });
                        addTranscript('agent', finalResponse.text);
                        endCall({ success: true, details: `Meeting scheduled for ${new Date(dateTime).toLocaleString()}` });
                        return; // End processing here
                    }
                }
            }
            // Once streaming is done, add the final complete message
            addTranscript('agent', lastText);

            // Once the full response is received, trigger the next client response
            handleClientResponse();

        } catch (error) {
            console.error("AI call error:", error);
            addTranscript('agent', "[Error communicating with AI]");
            endCall({ success: false, reason: "AI connection error." });
        }
    }, [endCall]); // We remove handleClientResponse from deps as it's defined inside
    
    // Initialize and start the call simulation
    useEffect(() => {
        const farm = farmName || "a local farm";
        const newChat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are a friendly and professional AI assistant making a phone call for a farmer at "${farm}". Your only goal is to schedule a meeting with the client. You must use the 'scheduleMeeting' function to do this. Keep your responses very brief and conversational, like a real phone call. Do not use markdown. Start the conversation by introducing yourself.`,
                tools: [{ functionDeclarations: [scheduleMeeting] }],
            },
        });
        chatRef.current = newChat;

        setStatus('Dialing...');
        
        const startConversation = async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            setStatus('In Progress');
            await processAIResponse(`The user wants you to call ${callData.contact} to ${callData.objective}. Start the call.`);
        };

        startConversation();

    }, [farmName, callData.contact, callData.objective, processAIResponse]);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    return (
        <div className="modal-overlay">
            <div className="call-agent-ui">
                <div className="call-agent-header">
                    <div className="avatar large"><i className="fa-solid fa-robot"></i></div>
                    <h3>Calling {callData.contact}</h3>
                    <p>Objective: {callData.objective}</p>
                    <div className={`call-status ${status.replace('...', '').replace(' ', '-').toLowerCase()}`}>{status}</div>
                </div>
                <div className="call-transcript">
                    {transcript.map((msg, index) => (
                        <div key={index} className={`transcript-message ${msg.speaker === 'client' ? 'client-message' : 'agent-message'}`}>
                            {msg.text}
                        </div>
                    ))}
                    <div ref={transcriptEndRef}></div>
                </div>
                <div className="call-agent-footer">
                    <button className="call-control-btn end-call" onClick={() => endCall({ success: false, reason: "Call ended by user." })}>
                        <i className="fa-solid fa-phone-slash"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

const AutomatedCallsSubPage = () => {
    const [farmName] = useState(localStorage.getItem('farmHubFarmName') || 'Your Farm');
    const [contact, setContact] = useState('');
    const [objective, setObjective] = useState('Schedule a meeting to discuss cassava prices.');
    const [callLog, setCallLog] = useState<any[]>([]);
    const [isCalling, setIsCalling] = useState(false);
    const [activeCallData, setActiveCallData] = useState<any>(null);
    const [error, setError] = useState('');

    const isContactsApiSupported = 'contacts' in navigator && 'ContactsManager' in window;

    const handleSelectContact = async () => {
        if (!isContactsApiSupported) return;
        try {
            const props = ['name', 'tel'];
            const opts = { multiple: false };
            
            const selectedContacts = await (navigator as any).contacts.select(props, opts);
            
            if (selectedContacts.length > 0) {
                const contactInfo = selectedContacts[0];
                const contactName = contactInfo.name?.[0] || '';
                const contactTel = contactInfo.tel?.[0] || '';
                
                setContact(contactName || contactTel || 'Unknown Contact');
            }
        } catch (ex) {
            console.error("Error selecting contact:", ex);
            setError("Could not access contacts. Please check permissions.");
        }
    };

    const handleStartCall = (e: React.FormEvent) => {
        e.preventDefault();
        if (!contact.trim() || !objective.trim()) {
            setError('Please provide a contact name/number and define the call objective.');
            return;
        }
        setError('');
        setActiveCallData({ contact, objective });
        setIsCalling(true);
    };

    const handleCallEnd = (logEntry: any) => {
        setCallLog(prev => [logEntry, ...prev]);
        setIsCalling(false);
        setActiveCallData(null);
    };

    const getOutcomeIcon = (outcome: any) => {
        if (outcome.success) {
            return <i className="fa-solid fa-check-circle success"></i>;
        }
        return <i className="fa-solid fa-times-circle failure"></i>;
    };

    return (
        <div>
            {isCalling && activeCallData && (
                <LiveCallUI 
                    farmName={farmName}
                    callData={activeCallData} 
                    onCallEnd={handleCallEnd} 
                />
            )}
            <div className="card">
                <h3>New Automated Call</h3>
                <p className="card-subtitle">Have the AI agent call a client to schedule a meeting. This is a simulation.</p>
                <form onSubmit={handleStartCall}>
                    <label htmlFor="contact-input">Contact Name or Number</label>
                    <div className="contact-input-wrapper">
                        <input
                            id="contact-input"
                            type="text"
                            className="input"
                            placeholder="e.g., Fatu Kamara or 088..."
                            value={contact}
                            onChange={e => setContact(e.target.value)}
                        />
                        {isContactsApiSupported && (
                            <button type="button" className="button icon-button" onClick={handleSelectContact} aria-label="Select from contacts">
                                <i className="fa-solid fa-address-book"></i>
                            </button>
                        )}
                    </div>

                    <label htmlFor="call-objective">Call Objective</label>
                    <textarea id="call-objective" className="textarea" value={objective} onChange={e => setObjective(e.target.value)}></textarea>
                    
                    {error && <p className="error-text">{error}</p>}

                    <button className="button" type="submit" disabled={isCalling}>
                        <i className="fa-solid fa-phone-volume"></i> Start Automated Call
                    </button>
                </form>
            </div>
            <div className="card">
                <h3>Call Log</h3>
                {callLog.length === 0 ? (
                    <p style={{color: 'var(--text-light)'}}>No calls have been made yet.</p>
                ) : (
                    <ul className="call-log-list">
                        {callLog.map(log => (
                            <li key={log.id} className="call-log-item">
                                <div className="call-log-icon">{getOutcomeIcon(log.outcome)}</div>
                                <div className="call-log-details">
                                    <strong>Call to {log.contact}</strong>
                                    <p className="call-log-objective">Objective: {log.objective}</p>
                                    <p className="call-log-outcome">
                                        Outcome: {log.outcome.success ? `Success - ${log.outcome.details}` : `Failed - ${log.outcome.reason}`}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const ChatbotSubPage = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<{role: string; text: string}[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const systemInstruction = `You are 'FarmHuub Helper', a friendly and professional AI chatbot. Your purpose is to assist users by answering their questions about the FarmHuub application's features. Provide clear, accurate, and concise information.

Here is a summary of the app's features:

*   **Scan Page:** Users can upload a photo of a plant or soil. The AI analyzes the image to diagnose crop diseases, identify healthy plants, or assess soil quality, providing detailed reports and recommendations.
*   **Blend Page:** Users can select multiple plants or crops. The AI generates a detailed analysis of the blend, including potential uses for food, medicine, livestock feed, and natural pesticides.
*   **Land Page:** This feature includes an interactive map where users can draw a plot of land to measure its area. They can then generate a formal-looking land survey document with coordinates, crop suggestions, and a map image.
*   **Climate Hub:** This section provides AI-powered weather forecasts and farming advice, plans for reclaiming barren land (wastelands), daily news updates on agriculture and climate, and a tool to find and apply for agricultural grants.
*   **Community Hub:** A social section where users can interact. It includes a 'Feed' for posts, a 'Market' to buy/sell produce, private 'Chats', 'Calls', 'Meetings', and a 'Video' producer to create marketing videos.
*   **Farm Admin Hub:** A comprehensive business management tool. It includes 'Finance' for tracking income/expenses and generating financial reports, 'Docs' for creating business plans and proposals, 'HR' for generating job descriptions and offer letters, and 'Legal' for drafting agreements.
*   **Agent Hub:** This is where you are! It features an 'AI Call Agent' that can simulate making phone calls to schedule meetings, and you, the 'AI Chatbot', to answer questions about the app.

When a user asks a question, identify which feature they are asking about and explain its functionality clearly. Be polite and always offer further assistance. Start your very first message by introducing yourself and asking how you can help.`;
        
        const newChat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
        });
        setChat(newChat);

        setLoading(true);
        newChat.sendMessage({message: "Hello!"}).then(response => {
            setMessages([{ role: 'ai', text: response.text }]);
            setLoading(false);
        }).catch(err => {
            console.error("Initial AI message failed", err);
            setMessages([{ role: 'ai', text: "Hello! I'm FarmHuub Helper. How can I assist you with the app's features today?" }]);
            setLoading(false);
        });

    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !chat || loading) return;

        const userMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await chat.sendMessage({ message: input });
            setMessages(prev => [...prev, { role: 'ai', text: response.text }]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{padding: 0, height: '65vh', minHeight: '500px', display: 'flex', flexDirection: 'column'}}>
            <div className="chat-window" style={{border: 'none', borderRadius: 'var(--border-radius)'}}>
                <div className="chat-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}>
                            {msg.text}
                        </div>
                    ))}
                    {loading && messages.length > 0 && (
                        <div className="chat-message ai-message">
                            <div className="spinner" style={{width: '20px', height: '20px'}}></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form id="chatbot-form" className="chat-input-form" onSubmit={sendMessage}>
                    <input 
                        type="text" 
                        placeholder="Ask about app features..." 
                        value={input} 
                        onChange={e => setInput(e.target.value)} 
                        disabled={loading} 
                    />
                    <button type="submit" className="send-button" disabled={loading || !input.trim()} aria-label="Send message">
                        <i className="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        </div>
    );
};

const CallAgentPage = ({ userTier, setActiveTab }: { userTier: 'free' | 'premium', setActiveTab: (tab: string) => void}) => {
  const [activeSubTab, setActiveSubTab] = useState('chatbot');

  const renderSubPage = () => {
    if (activeSubTab === 'calls' && userTier === 'free') {
      return <PremiumLockPage setActiveTab={setActiveTab} />;
    }
    switch (activeSubTab) {
      case 'calls': return <AutomatedCallsSubPage />;
      case 'chatbot': return <ChatbotSubPage />;
      default: return <ChatbotSubPage />;
    }
  };

  const tabs = [
    { id: 'chatbot', label: 'Chatbot', icon: 'fa-solid fa-comment-dots' },
    { id: 'calls', label: 'Call Agent', icon: 'fa-solid fa-phone-volume' },
  ];

  return (
    <div>
      <h2>AI Agent Hub</h2>
      <div className="sub-nav">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`sub-nav-button ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => {
                if (tab.id === 'calls' && userTier === 'free') {
                    setActiveTab('upgrade');
                } else {
                    setActiveSubTab(tab.id);
                }
            }}
          >
            <i className={tab.icon}></i>
            <span>{tab.label}</span>
            {tab.id === 'calls' && userTier === 'free' && <i className="fa-solid fa-lock lock-icon-inline"></i>}
          </button>
        ))}
      </div>
      <div className="sub-page-content">
        {renderSubPage()}
      </div>
    </div>
  );
};

// --- SUBSCRIPTION & GATING COMPONENTS ---
const PremiumLockPage = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => (
  <div className="premium-lock-container">
    <div className="card premium-lock-card">
      <i className="fa-solid fa-gem premium-icon"></i>
      <h3>Unlock Premium Features</h3>
      <p>Upgrade your account to access this feature and many more powerful tools to boost your agribusiness.</p>
      <ul className="feature-list-lock">
          <li><i className="fa-solid fa-check"></i> All Admin Hub tools</li>
          <li><i className="fa-solid fa-check"></i> Advanced AI Agri-Bot</li>
          <li><i className="fa-solid fa-check"></i> Automated AI Call Agent</li>
          <li><i className="fa-solid fa-check"></i> Unlimited Land Surveys</li>
          <li><i className="fa-solid fa-check"></i> And much more!</li>
      </ul>
      <button className="button" onClick={() => setActiveTab('upgrade')}>
        <i className="fa-solid fa-rocket"></i> Upgrade to Premium
      </button>
    </div>
  </div>
);

const UpgradePage = ({ onUpgrade, country }: { onUpgrade: () => void, country: any }) => {
    const [plan, setPlan] = useState('yearly');
    const [paymentMethod, setPaymentMethod] = useState('card');
    const [paymentProof, setPaymentProof] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    
    const basePricesUSD = { monthly: 10, yearly: 100 };

    const formatLocalCurrency = (amount: number) => {
        const localAmount = amount * country.exchangeRateToUSD;
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: country.currency.code,
        }).format(localAmount);
    };
    
    const monthlyPrice = formatLocalCurrency(basePricesUSD.monthly);
    const yearlyPrice = formatLocalCurrency(basePricesUSD.yearly);

    const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPaymentProof(file);
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setProofPreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                setProofPreview(file.name);
            }
        }
    };

    const handleConfirmUpgrade = () => {
        if (paymentMethod !== 'card') {
            if (!paymentProof) {
                alert("Please upload proof of payment to proceed.");
                return;
            }
            alert("Thank you! Your payment is being verified. Your account will be upgraded to Premium within 24 hours.");
        }
        onUpgrade();
    };
    
    const manualPaymentMethods = ['moneygram', 'westernunion', 'worldremit', 'ria', 'afrointernational', 'bank', 'mobile'];
    
    return (
        <div>
            <h2>Upgrade to FarmHuub Premium</h2>
            <div className="card">
                <h3>Choose Your Plan</h3>
                <div className="plan-selector">
                    <div className={`plan-card ${plan === 'monthly' ? 'selected' : ''}`} onClick={() => setPlan('monthly')}>
                        <h4>Monthly</h4>
                        <p className="price">{monthlyPrice}<span>/month</span></p>
                        <p className="billing-info">(approx. ${basePricesUSD.monthly} USD)</p>
                    </div>
                    <div className={`plan-card ${plan === 'yearly' ? 'selected' : ''}`} onClick={() => setPlan('yearly')}>
                         <div className="best-value-badge">Best Value</div>
                        <h4>Yearly</h4>
                        <p className="price">{yearlyPrice}<span>/year</span></p>
                        <p className="billing-info">(approx. ${basePricesUSD.yearly} USD)</p>
                    </div>
                </div>
            </div>
            
            <div className="card">
                <h3>Payment Details</h3>
                <div className="sub-nav payment-tabs">
                    <button className={`sub-nav-button ${paymentMethod === 'card' ? 'active' : ''}`} onClick={() => setPaymentMethod('card')}><i className="fa-solid fa-credit-card"></i> Card</button>
                    <button className={`sub-nav-button ${paymentMethod === 'moneygram' ? 'active' : ''}`} onClick={() => setPaymentMethod('moneygram')}>MoneyGram</button>
                    <button className={`sub-nav-button ${paymentMethod === 'westernunion' ? 'active' : ''}`} onClick={() => setPaymentMethod('westernunion')}>Western Union</button>
                    <button className={`sub-nav-button ${paymentMethod === 'worldremit' ? 'active' : ''}`} onClick={() => setPaymentMethod('worldremit')}>World Remit</button>
                    <button className={`sub-nav-button ${paymentMethod === 'ria' ? 'active' : ''}`} onClick={() => setPaymentMethod('ria')}>Ria</button>
                    <button className={`sub-nav-button ${paymentMethod === 'afrointernational' ? 'active' : ''}`} onClick={() => setPaymentMethod('afrointernational')}>Afro Intl.</button>
                    <button className={`sub-nav-button ${paymentMethod === 'mobile' ? 'active' : ''}`} onClick={() => setPaymentMethod('mobile')}><i className="fa-solid fa-mobile-screen-button"></i> Mobile</button>
                </div>
                
                <div className="payment-details-content">
                    {paymentMethod === 'card' && (
                        <form className="payment-form">
                            <label>Card Number</label><input type="text" className="input" placeholder="0000 0000 0000 0000" />
                            <div style={{display: 'flex', gap: '15px'}}>
                                <div style={{flex: 1}}><label>Expiry Date</label><input type="text" className="input" placeholder="MM / YY" /></div>
                                <div style={{flex: 1}}><label>CVC</label><input type="text" className="input" placeholder="123" /></div>
                            </div>
                        </form>
                    )}
                    {manualPaymentMethods.includes(paymentMethod) && (
                        <div className="bank-details">
                            <p>Please use your preferred service to send the equivalent of <strong>{plan === 'monthly' ? `$${basePricesUSD.monthly}` : `$${basePricesUSD.yearly}`} USD</strong>.</p>
                             <p>After payment, send the transaction reference/receipt via:</p>
                             <ul>
                                <li><strong>Email:</strong> ifeasalone@gmail.com</li>
                                <li><strong>WhatsApp:</strong> +232 88 635 309</li>
                            </ul>
                            <p>Then, upload the same receipt below for verification.</p>
                        </div>
                    )}
                    
                    {manualPaymentMethods.includes(paymentMethod) && (
                        <div className="payment-proof-uploader">
                            <h4>Upload Payment Confirmation</h4>
                            <p>Please upload a screenshot or document (PDF, JPG, PNG) of your transaction receipt.</p>
                            <input type="file" id="payment-proof-upload" accept=".pdf,.jpg,.jpeg,.png" onChange={handleProofChange} style={{display: 'none'}} />
                            <label htmlFor="payment-proof-upload" className="file-input-label">
                                {paymentProof ? (
                                    <span><i className="fa-solid fa-check-circle"></i> {paymentProof.name}</span>
                                ) : (
                                    <span><i className="fa-solid fa-upload"></i> Choose a file...</span>
                                )}
                            </label>
                            {proofPreview && (
                                <div className="proof-preview">
                                    {paymentProof && paymentProof.type.startsWith('image/') ? (
                                        <img src={proofPreview} alt="Payment proof preview" />
                                    ) : (
                                        <div className="file-icon-preview">
                                            <i className="fa-solid fa-file-pdf"></i>
                                            <span>{proofPreview}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <button className="button" onClick={handleConfirmUpgrade} style={{fontSize: '18px', padding: '15px'}}>
               <i className="fa-solid fa-lock-open"></i> Confirm & Upgrade Now
            </button>
        </div>
    );
};


// --- MAIN APP ---
const SidebarNav = ({ activeTab, setActiveTab, navButtons, logo, onLogoClick, userTier }) => {
    const premiumTabs = ['scan', 'blend', 'land', 'climate', 'admin', 'ai'];
    
    return (
        <nav className="sidebar-nav" aria-label="Main Navigation">
          <header className="sidebar-header">
            <div className="logo" onClick={onLogoClick} style={{ cursor: 'pointer' }} title="Change logo" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onLogoClick()}>
              {logo ? <img src={logo} alt="Farm Logo" className="header-logo-img" /> : 'FH'}
            </div>
            <h1>FarmHuub</h1>
          </header>
          <div className="sidebar-nav-links">
            {navButtons.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-button ${activeTab === tab.id ? 'active' : ''} ${tab.isUpgrade ? 'upgrade-button' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                disabled={tab.id === 'upgrade' && userTier === 'premium'}
              >
                <i className={tab.icon} aria-hidden="true"></i>
                <span>{tab.label}</span>
                {premiumTabs.includes(tab.id) && userTier === 'free' && <i className="fa-solid fa-lock lock-icon"></i>}
                 {tab.id === 'upgrade' && userTier === 'premium' && <span className="premium-badge">Premium</span>}
              </button>
            ))}
          </div>
        </nav>
    );
};

const App = () => {
  const [activeTab, setActiveTab] = useState('community');
  const [userTier, setUserTier] = useState<'free' | 'premium'>('free');
  const [businessLogo, setBusinessLogo] = useState<string | null>(localStorage.getItem('farmHubLogo'));
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState('SL');
  const [language, setLanguage] = useState('en-US');

  const currentCountry = useMemo(() => countries.find(c => c.code === selectedCountryCode) || countries[0], [selectedCountryCode]);
  const availableLanguages = useMemo(() => currentCountry.languages, [currentCountry]);

  useEffect(() => {
    // When country changes, set language to the first available language for that country
    if (availableLanguages.length > 0) {
        setLanguage(availableLanguages[0].code);
    }
  }, [selectedCountryCode, availableLanguages]);
  
  const initialPosts = [
    { id: 1, author: "FarmConnect SL", avatar: "FC", content: "Great harvest of peppers this season! Ready for the market. #agriculture #sierraleone", image: true },
    { id: 2, author: "FarmHuub Official", avatar: "FH", content: "Our latest workshop on sustainable farming techniques was a success! Thanks to all who participated.", image: false },
  ];
  const [communityPosts, setCommunityPosts] = useState(initialPosts);

  const addCommunityPost = (post: any) => {
    const newPost = { ...post, id: Date.now() }; // Add a unique ID
    setCommunityPosts(prev => [newPost, ...prev]);
  };
  
  const handleLogoClick = () => {
    logoInputRef.current?.click();
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newLogo = reader.result as string;
        setBusinessLogo(newLogo);
        localStorage.setItem('farmHubLogo', newLogo);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpgrade = () => {
      setUserTier('premium');
      setActiveTab('admin'); // Redirect to a premium page after successful upgrade
      alert("Upgrade successful! Welcome to FarmHuub Premium. All features are now unlocked.");
  };

  const premiumTabs = ['scan', 'blend', 'land', 'climate', 'admin', 'ai'];

  const renderPage = () => {
    if (userTier === 'free' && premiumTabs.includes(activeTab)) {
        return <PremiumLockPage setActiveTab={setActiveTab} />;
    }
    
    switch (activeTab) {
        case 'scan': return <ScanPage countryName={currentCountry.name} />;
        case 'blend': return <BlendPage countryName={currentCountry.name} />;
        case 'land': return <LandPage countryName={currentCountry.name} />;
        case 'climate': return <ClimatePage 
            userTier={userTier} 
            language={language} setLanguage={setLanguage} 
            selectedCountry={selectedCountryCode} setSelectedCountry={setSelectedCountryCode}
            availableLanguages={availableLanguages} countryName={currentCountry.name}
        />;
        case 'community': return <CommunityPage communityPosts={communityPosts} addCommunityPost={addCommunityPost} countryName={currentCountry.name} />;
        case 'ai': return <AIHubPage 
            language={language} setLanguage={setLanguage} 
            selectedCountry={selectedCountryCode} setSelectedCountry={setSelectedCountryCode}
            availableLanguages={availableLanguages} countryName={currentCountry.name}
        />;
        case 'agent': return <CallAgentPage userTier={userTier} setActiveTab={setActiveTab} />;
        case 'admin': return <FarmAdminPage addCommunityPost={addCommunityPost} logo={businessLogo} onLogoChange={handleLogoFileChange} />;
        case 'upgrade': return userTier === 'free' ? <UpgradePage onUpgrade={handleUpgrade} country={currentCountry} /> : <CommunityPage communityPosts={communityPosts} addCommunityPost={addCommunityPost} countryName={currentCountry.name} />;
        default: return <CommunityPage communityPosts={communityPosts} addCommunityPost={addCommunityPost} countryName={currentCountry.name} />;
    }
  };

  const navButtons = [
      { id: 'admin', icon: 'fa-solid fa-chart-pie', label: 'Admin' },
      { id: 'agent', icon: 'fa-solid fa-headset', label: 'Agent' },
      { id: 'ai', icon: 'fa-solid fa-robot', label: 'AI Hub' },
      { id: 'blend', icon: 'fa-solid fa-mortar-pestle', label: 'Blend' },
      { id: 'climate', icon: 'fa-solid fa-cloud-sun-rain', label: 'Climate' },
      { id: 'community', icon: 'fa-solid fa-users', label: 'Community' },
      { id: 'land', icon: 'fa-solid fa-map-location-dot', label: 'Land' },
      { id: 'scan', icon: 'fa-solid fa-camera', label: 'Scan' },
      { id: 'upgrade', icon: 'fa-solid fa-gem', label: 'Upgrade', isUpgrade: true },
  ].sort((a,b) => {
      if (a.isUpgrade) return -1; // always put upgrade first
      if (b.isUpgrade) return 1;
      return a.label.localeCompare(b.label);
  });
  
  const filteredNavButtons = userTier === 'premium' ? navButtons.filter(b => b.id !== 'upgrade') : navButtons;

  return (
    <div className="app-container">
      <input
        type="file"
        ref={logoInputRef}
        onChange={handleLogoFileChange}
        accept="image/*"
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      
      <SidebarNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        navButtons={navButtons} 
        logo={businessLogo}
        onLogoClick={handleLogoClick}
        userTier={userTier}
      />
      
      <div className="main-content-wrapper">
          <Header logo={businessLogo} onLogoClick={handleLogoClick} />
          <main className="page-content">{renderPage()}</main>
          <Footer />
      </div>

      <nav className="bottom-nav">
        {filteredNavButtons.map(tab => (
          <button
            key={tab.id}
            className={`nav-button ${activeTab === tab.id ? 'active' : ''} ${tab.isUpgrade ? 'upgrade-button' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <i className={tab.icon} aria-hidden="true"></i>
            <span>{tab.label}</span>
            {userTier === 'free' && premiumTabs.includes(tab.id) && <i className="fa-solid fa-lock lock-icon-mobile"></i>}
          </button>
        ))}
      </nav>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
