import Product from "../model/product_model.js";
import { catchAsync } from "../middleware/errorhandling.js";
import { uploadProductImage } from "../middleware/upload.js";

// ======================= GET ALL PRODUCTS (with search, filter, sort) =======================
export const getProducts = catchAsync(async (req, res) => {
  const { search, category, minPrice, maxPrice, sort, featured, limit = 50, page = 1 } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
    ];
  }

  if (category && category !== "All") {
    query.category = { $regex: new RegExp(`^${category}$`, "i") };
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (featured === "true") {
    query.isFeatured = true;
  }

  let sortOption = { createdAt: -1 };
  if (sort === "price_asc") sortOption = { price: 1 };
  else if (sort === "price_desc") sortOption = { price: -1 };
  else if (sort === "rating") sortOption = { rating: -1 };
  else if (sort === "newest") sortOption = { createdAt: -1 };

  const parsedLimit = parseInt(limit, 10);
  const parsedPage = parseInt(page, 10);
  const skip = (parsedPage - 1) * parsedLimit;

  const total = await Product.countDocuments(query);
  const products = await Product.find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(parsedLimit);

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    page: parsedPage,
    pages: Math.ceil(total / parsedLimit) || 1,
    products,
  });
});

// ======================= GET SINGLE PRODUCT =======================
export const getProductById = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  res.status(200).json({
    success: true,
    product,
  });
});

// ======================= GET CATEGORIES =======================
export const getCategories = catchAsync(async (req, res) => {
  const categories = await Product.distinct("category");
  res.status(200).json({
    success: true,
    categories,
  });
});

// ======================= CREATE PRODUCT (Admin) =======================
export const createProduct = catchAsync(async (req, res) => {
  const { title, description, price, discountPrice, category, brand, stock, isFeatured, isTrending, specs } = req.body;

  let imageUrls = [];

  // 1. If images passed as JSON string or array in body
  if (req.body.images) {
    if (Array.isArray(req.body.images)) {
      imageUrls = [...req.body.images];
    } else if (typeof req.body.images === "string") {
      try {
        const parsed = JSON.parse(req.body.images);
        if (Array.isArray(parsed)) imageUrls = [...parsed];
        else imageUrls.push(req.body.images);
      } catch {
        imageUrls.push(req.body.images);
      }
    }
  }

  // 2. If files uploaded via multer
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      try {
        const url = await uploadProductImage(file.buffer);
        imageUrls.push(url);
      } catch (err) {
        console.warn("⚠️ Failed to upload an image to Cloudinary:", err.message);
      }
    }
  }

  // Parse specs if string
  let parsedSpecs = [];
  if (specs) {
    if (Array.isArray(specs)) {
      parsedSpecs = specs;
    } else if (typeof specs === "string") {
      try {
        parsedSpecs = JSON.parse(specs);
      } catch {}
    }
  }

  const product = new Product({
    title,
    description,
    price: Number(price),
    discountPrice: discountPrice ? Number(discountPrice) : 0,
    category,
    brand: brand || "Generic",
    stock: stock !== undefined ? Number(stock) : 10,
    images: imageUrls,
    isFeatured: isFeatured === "true" || isFeatured === true,
    isTrending: isTrending === "true" || isTrending === true,
    specs: parsedSpecs,
  });

  await product.save();

  res.status(201).json({
    success: true,
    message: "Product created successfully",
    product,
  });
});

// ======================= UPDATE PRODUCT (Admin) =======================
export const updateProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const { title, description, price, discountPrice, category, brand, stock, isFeatured, isTrending, specs, removeImages } = req.body;

  if (title !== undefined) product.title = title;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = Number(price);
  if (discountPrice !== undefined) product.discountPrice = Number(discountPrice);
  if (category !== undefined) product.category = category;
  if (brand !== undefined) product.brand = brand;
  if (stock !== undefined) product.stock = Number(stock);
  if (isFeatured !== undefined) product.isFeatured = isFeatured === "true" || isFeatured === true;
  if (isTrending !== undefined) product.isTrending = isTrending === "true" || isTrending === true;

  // Handle removeImages
  if (removeImages) {
    let imagesToRemove = [];
    if (Array.isArray(removeImages)) imagesToRemove = removeImages;
    else if (typeof removeImages === "string") {
      try {
        const parsed = JSON.parse(removeImages);
        if (Array.isArray(parsed)) imagesToRemove = parsed;
        else imagesToRemove = [removeImages];
      } catch {
        imagesToRemove = [removeImages];
      }
    }
    product.images = product.images.filter((img) => !imagesToRemove.includes(img));
  }

  // Handle explicit image URLs in body
  if (req.body.images) {
    let explicitImages = [];
    if (Array.isArray(req.body.images)) explicitImages = req.body.images;
    else if (typeof req.body.images === "string") {
      try {
        const parsed = JSON.parse(req.body.images);
        if (Array.isArray(parsed)) explicitImages = parsed;
        else explicitImages = [req.body.images];
      } catch {
        explicitImages = [req.body.images];
      }
    }
    // Append unique URLs
    explicitImages.forEach((img) => {
      if (img && !product.images.includes(img)) {
        product.images.push(img);
      }
    });
  }

  // Handle new uploaded files
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      try {
        const url = await uploadProductImage(file.buffer);
        product.images.push(url);
      } catch (err) {
        console.warn("⚠️ Failed to upload image during update:", err.message);
      }
    }
  }

  if (specs) {
    if (Array.isArray(specs)) product.specs = specs;
    else if (typeof specs === "string") {
      try { product.specs = JSON.parse(specs); } catch {}
    }
  }

  await product.save();

  res.status(200).json({
    success: true,
    message: "Product updated successfully",
    product,
  });
});

// ======================= DELETE PRODUCT (Admin) =======================
export const deleteProduct = catchAsync(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  });
});

// ======================= ADD / UPDATE PRODUCT REVIEW =======================
export const addProductReview = catchAsync(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ success: false, message: "Please provide a valid rating between 1 and 5 stars" });
  }

  if (!comment || !comment.trim()) {
    return res.status(400).json({ success: false, message: "Please write a review comment" });
  }

  const reviewerName = `${req.user.first_name || ""} ${req.user.last_name || ""}`.trim() || req.user.email;

  // Check if user already reviewed
  const alreadyReviewedIndex = product.reviews.findIndex(
    (r) => r.user && r.user.toString() === req.user._id.toString()
  );

  if (alreadyReviewedIndex > -1) {
    // Update existing review
    product.reviews[alreadyReviewedIndex].rating = Number(rating);
    product.reviews[alreadyReviewedIndex].comment = comment.trim();
    product.reviews[alreadyReviewedIndex].name = reviewerName;
    product.reviews[alreadyReviewedIndex].createdAt = new Date();
  } else {
    // Add new review
    product.reviews.push({
      user: req.user._id,
      name: reviewerName,
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: new Date(),
    });
  }

  product.numReviews = product.reviews.length;
  const totalRating = product.reviews.reduce((sum, item) => sum + item.rating, 0);
  product.rating = Number((totalRating / product.reviews.length).toFixed(1));

  await product.save();

  res.status(201).json({
    success: true,
    message: alreadyReviewedIndex > -1 ? "Review updated successfully!" : "Review submitted successfully!",
    product,
  });
});

// ======================= SEED SAMPLE PRODUCTS =======================
export const seedProducts = catchAsync(async (req, res) => {
  const sampleProducts = [
    {
      title: "Aura Noise-Cancelling Wireless Headphones",
      description: "Experience studio-grade acoustics with advanced active noise cancellation, 40-hour battery life, and plush memory foam earcups.",
      price: 2499,
      discountPrice: 1999,
      category: "Electronics",
      brand: "AuraSound",
      stock: 45,
      rating: 4.9,
      numReviews: 3,
      isFeatured: true,
      isTrending: true,
      images: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=1000&q=80"
      ],
      reviews: [
        {
          name: "Aarav Sharma",
          rating: 5,
          comment: "Outstanding ANC performance and crisp bass. Battery lasted me almost a whole week on daily commute in Bangalore!",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Priya Nair",
          rating: 5,
          comment: "Super comfortable for long Zoom meetings and coding sessions. The build quality feels very premium.",
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Rohan Verma",
          rating: 4,
          comment: "Great soundstage and microphone clarity. Delivery was lightning fast via express shipping.",
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        }
      ],
      specs: [
        { key: "Battery Life", value: "40 Hours" },
        { key: "Connectivity", value: "Bluetooth 5.3" },
        { key: "Weight", value: "250g" }
      ]
    },
    {
      title: "Minimalist Chrono Watch in Brushed Steel",
      description: "Crafted with precision Swiss quartz movement, sapphire crystal glass, and interchangeable Italian leather straps.",
      price: 4999,
      discountPrice: 3499,
      category: "Accessories",
      brand: "NordicTime",
      stock: 28,
      rating: 5.0,
      numReviews: 2,
      isFeatured: true,
      isTrending: false,
      images: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=80"
      ],
      reviews: [
        {
          name: "Vikram Malhotra",
          rating: 5,
          comment: "Pure luxury aesthetic. The brushed steel case catches the light nicely and looks great with formal suits.",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Sneha Patel",
          rating: 5,
          comment: "Bought this as an anniversary gift. Extremely well packaged in a deluxe wooden box.",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }
      ],
      specs: [
        { key: "Case Material", value: "316L Stainless Steel" },
        { key: "Water Resistance", value: "5 ATM (50 meters)" }
      ]
    },
    {
      title: "Monochrome Urban Runner Sneakers",
      description: "Ultra-responsive foam cushioning engineered for daily agility, lightweight breathable mesh upper, and high-traction rubber outsole.",
      price: 3299,
      discountPrice: 2499,
      category: "Footwear",
      brand: "Velocity",
      stock: 60,
      rating: 4.7,
      numReviews: 3,
      isFeatured: true,
      isTrending: true,
      images: [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1000&q=80"
      ],
      reviews: [
        {
          name: "Karan Singhal",
          rating: 5,
          comment: "Extremely lightweight and great arch support for running 5k every morning.",
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Ananya Iyer",
          rating: 5,
          comment: "Sleek silhouette, fits true to size, and looks very stylish with relaxed streetwear.",
          createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Devendra Joshi",
          rating: 4,
          comment: "Cushioning is plush. Delivered in 2 days across Delhi NCR.",
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        }
      ],
      specs: [
        { key: "Material", value: "Breathable Knit & TPU" },
        { key: "Sole", value: "High-Rebound EVA" }
      ]
    },
    {
      title: "Artisan Ceramic Pour-Over Coffee Set",
      description: "Handcrafted matte ceramic dripper and server pot with insulated walnut handle. Brew aromatic, balanced coffee in elegant style.",
      price: 1499,
      discountPrice: 1199,
      category: "Home & Living",
      brand: "Komorebi",
      stock: 35,
      rating: 5.0,
      numReviews: 2,
      isFeatured: false,
      isTrending: true,
      images: [
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=1000&q=80"
      ],
      reviews: [
        {
          name: "Meera Deshmukh",
          rating: 5,
          comment: "Morning coffee ritual upgraded! The heat retention and ceramic finish are top tier.",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Aditya Roy",
          rating: 5,
          comment: "Beautiful handcrafted aesthetic on my kitchen countertop. Brews very clean single-origin pour-overs.",
          createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        }
      ],
      specs: [
        { key: "Capacity", value: "600ml (2-4 cups)" },
        { key: "Finish", value: "Matte Stoneware" }
      ]
    },
    {
      title: "Tailored Linen Overshirt in Sand",
      description: "Relaxed fit made from 100% organic French linen. Breathable, durable, and naturally textured for refined casual layering.",
      price: 2199,
      discountPrice: 1799,
      category: "Fashion",
      brand: "Atelier",
      stock: 40,
      rating: 4.5,
      numReviews: 2,
      isFeatured: true,
      isTrending: false,
      images: [
        "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80"
      ],
      reviews: [
        {
          name: "Siddharth Sen",
          rating: 5,
          comment: "Fabric is soft and breathable in humid summer weather. Cuts a very sharp casual look.",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Kavya Menon",
          rating: 4,
          comment: "High quality stitching and organic linen texture. Exactly matches the pictures.",
          createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
        }
      ],
      specs: [
        { key: "Fabric", value: "100% Organic Linen" },
        { key: "Care", value: "Machine Wash Cold" }
      ]
    },
    {
      title: "Botanical Hydration Glow Serum",
      description: "Infused with pure hyaluronic acid, niacinamide, and rosehip extract to deliver deep moisture and radiant complexion.",
      price: 999,
      discountPrice: 799,
      category: "Beauty",
      brand: "Lumiere Botanics",
      stock: 80,
      rating: 5.0,
      numReviews: 2,
      isFeatured: false,
      isTrending: true,
      images: [
        "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1608248597359-20f779774640?auto=format&fit=crop&w=1000&q=80"
      ],
      reviews: [
        {
          name: "Rhea Kapoor",
          rating: 5,
          comment: "Absorbs immediately without any sticky residue. Noticeable glow within just one week!",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Pooja Hegde",
          rating: 5,
          comment: "Very gentle on sensitive skin. Smells naturally botanical and refreshing.",
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        }
      ],
      specs: [
        { key: "Volume", value: "50ml / 1.7 fl oz" },
        { key: "Formulation", value: "Vegan & Cruelty Free" }
      ]
    },
    {
      title: "Smart Ergonomic Desk Lamp with Wireless Charger",
      description: "Warm-to-cool LED lighting with touch dimmer, integrated 15W Qi fast charging pad, and flexible anodized aluminum arm.",
      price: 1899,
      discountPrice: 1499,
      category: "Electronics",
      brand: "Lumino",
      stock: 30,
      rating: 4.8,
      numReviews: 2,
      isFeatured: false,
      isTrending: false,
      images: [
        "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1534972195531-a756b1126f24?auto=format&fit=crop&w=1000&q=80"
      ],
      reviews: [
        {
          name: "Manish Aggarwal",
          rating: 5,
          comment: "Wireless charging fast-charges my phone while I work. Multiple light temperature settings are great for eye fatigue.",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Tara Sundaram",
          rating: 4.5,
          comment: "Minimalist aesthetic desk addition. The dimming control is very smooth.",
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        }
      ],
      specs: [
        { key: "Power Output", value: "15W Wireless + USB-C" },
        { key: "Color Temperature", value: "2700K - 6500K" }
      ]
    },
    {
      title: "Handmade Full-Grain Leather Weekender Bag",
      description: "Spacious luxury travel bag with separate shoe compartment, brass YKK zippers, and padded adjustable shoulder strap.",
      price: 5499,
      discountPrice: 4299,
      category: "Accessories",
      brand: "Heritage Craft",
      stock: 18,
      rating: 5.0,
      numReviews: 2,
      isFeatured: true,
      isTrending: true,
      images: [
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=1000&q=80"
      ],
      reviews: [
        {
          name: "Rajesh Kumar",
          rating: 5,
          comment: "Authentic full-grain leather scent and unmatched durability. Took it on two weekend trips and received compliments everywhere.",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
        {
          name: "Shreya Ghoshal",
          rating: 5,
          comment: "Separate shoe compartment is a lifesaver. The brass hardware is very sturdy.",
          createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        }
      ],
      specs: [
        { key: "Dimensions", value: "52 x 28 x 25 cm" },
        { key: "Material", value: "Full-Grain Cowhide Leather" }
      ]
    }
  ];

  await Product.deleteMany({});
  const created = await Product.insertMany(sampleProducts);

  res.status(201).json({
    success: true,
    message: `Successfully seeded ${created.length} luxury products with real customer reviews`,
    count: created.length,
    products: created,
  });
});
