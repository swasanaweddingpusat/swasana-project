import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { PrismaClient, ProfileStatus } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Truncate (urutan penting: child tables dulu, baru parent) ────────────
  await prisma.activityLog.deleteMany();
  await prisma.userVenueAccess.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.vendorCategory.deleteMany();
  await prisma.packageInternalItem.deleteMany();
  await prisma.packageVendorItem.deleteMany();
  await prisma.packageVariant.deleteMany();
  await prisma.package.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.sourceOfInformation.deleteMany();
  await prisma.customerMemberStatus.deleteMany();
  await prisma.customer.deleteMany();
  console.log("🗑️  Database truncated");

  // ─── Roles ────────────────────────────────────────────────────────────────
  const roleData = [
    { name: "Super Admin", description: "All Access", sortOrder: 1 },
    { name: "direktur sales", description: "Access to sales data and customer management", sortOrder: 2 },
    { name: "manager", description: "Full access to all features and user management", sortOrder: 3 },
    { name: "direktur operational", description: "All Access", sortOrder: 4 },
    { name: "operational", description: "All Access", sortOrder: 5 },
    { name: "finance", description: "Access to financial data and reports", sortOrder: 6 },
    { name: "sales", description: "Access to sales data and customer management", sortOrder: 7 },
    { name: "vendor specialist", description: "Manage Data Vendor Specialist", sortOrder: 8 },
    { name: "human resource", description: "Access to human resource", sortOrder: 9 },
  ];

  for (const data of roleData) {
    await prisma.role.create({ data });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Super Admin" } });
  console.log(`✅ ${roleData.length} Roles seeded`);

  // ─── Permissions (real data from production) ────────────────────────────────
  const permissionData: { module: string; action: string; description?: string }[] = [
    // attendance
    { module: "attendance", action: "view", description: "View own attendance records" },
    { module: "attendance", action: "create", description: "Create own attendance record (check-in)" },
    { module: "attendance", action: "edit", description: "Edit own attendance records" },
    { module: "attendance", action: "delete", description: "Delete own attendance records" },
    // booking
    { module: "booking", action: "view" },
    { module: "booking", action: "create" },
    { module: "booking", action: "edit" },
    { module: "booking", action: "delete" },
    { module: "booking", action: "print", description: "Print/generate PDF documents" },
    { module: "booking", action: "approve", description: "Approve/confirm booking" },
    { module: "booking", action: "approve_manager", description: "Approve PO as manager" },
    { module: "booking", action: "approve_finance", description: "Approve PO as finance" },
    { module: "booking", action: "approve_oprations", description: "Approve PO as oprations" },
    { module: "booking", action: "mark_lost", description: "Mark booking as lost" },
    { module: "booking", action: "restore", description: "Restore booking from lost/confirmed" },
    // brand_management
    { module: "brand_management", action: "view", description: "View brand management" },
    { module: "brand_management", action: "create", description: "Create brand management" },
    { module: "brand_management", action: "edit", description: "Edit brand management" },
    { module: "brand_management", action: "delete", description: "Delete brand management" },
    // calendar_event
    { module: "calendar_event", action: "view" },
    { module: "calendar_event", action: "create" },
    { module: "calendar_event", action: "edit" },
    { module: "calendar_event", action: "delete" },
    // customers
    { module: "customers", action: "view" },
    { module: "customers", action: "create" },
    { module: "customers", action: "edit" },
    { module: "customers", action: "delete" },
    // dashboard
    { module: "dashboard", action: "view" },
    { module: "dashboard", action: "create" },
    { module: "dashboard", action: "edit" },
    { module: "dashboard", action: "delete" },
    // addons - removed
    // purchase_order - removed
    // venue - removed (use venue_management instead)
    // finance_ap
    { module: "finance_ap", action: "view" },
    { module: "finance_ap", action: "create" },
    { module: "finance_ap", action: "edit" },
    { module: "finance_ap", action: "delete" },
    // finance_ar
    { module: "finance_ar", action: "view" },
    { module: "finance_ar", action: "create" },
    { module: "finance_ar", action: "edit" },
    { module: "finance_ar", action: "delete" },
    // hr
    { module: "hr", action: "view", description: "View HR & Payroll menu" },
    { module: "hr", action: "create", description: "Create HR & Payroll data" },
    { module: "hr", action: "edit", description: "Edit HR & Payroll data" },
    { module: "hr", action: "delete", description: "Delete HR & Payroll data" },
    { module: "hr", action: "view_all", description: "View all HR & Payroll data" },
    { module: "hr", action: "approve", description: "Approve HR & Payroll requests" },
    { module: "hr", action: "approve_manager", description: "Approve HR & Payroll requests as manager" },
    { module: "hr", action: "approve_finance", description: "Approve HR & Payroll requests as finance" },
    { module: "hr", action: "approve_oprations", description: "Approve HR & Payroll requests as operations" },
    { module: "hr", action: "print", description: "Print HR & Payroll documents" },
    { module: "hr", action: "mark_lost", description: "Mark HR & Payroll record as lost" },
    { module: "hr", action: "restore", description: "Restore HR & Payroll record" },
    // package
    { module: "package", action: "view" },
    { module: "package", action: "create" },
    { module: "package", action: "edit" },
    { module: "package", action: "delete" },
    // payment_methods
    { module: "payment_methods", action: "view", description: "View payment methods" },
    { module: "payment_methods", action: "create", description: "Create payment methods" },
    { module: "payment_methods", action: "edit", description: "Edit payment methods" },
    { module: "payment_methods", action: "delete", description: "Delete payment methods" },
    // purchase_order removed
    // role_permission
    { module: "role_permission", action: "view", description: "View role & permission" },
    { module: "role_permission", action: "create", description: "Create role & permission" },
    { module: "role_permission", action: "edit", description: "Edit role & permission" },
    { module: "role_permission", action: "delete", description: "Delete role & permission" },
    // settings
    { module: "settings", action: "view" },
    { module: "settings", action: "create" },
    { module: "settings", action: "edit" },
    { module: "settings", action: "delete" },
    // source_of_information
    { module: "source_of_information", action: "view", description: "View source of information" },
    { module: "source_of_information", action: "create", description: "Create source of information" },
    { module: "source_of_information", action: "edit", description: "Edit source of information" },
    { module: "source_of_information", action: "delete", description: "Delete source of information" },
    // user_management
    { module: "user_management", action: "view" },
    { module: "user_management", action: "create" },
    { module: "user_management", action: "edit" },
    { module: "user_management", action: "delete" },
    // vendor
    { module: "vendor", action: "view" },
    { module: "vendor", action: "create" },
    { module: "vendor", action: "edit" },
    { module: "vendor", action: "delete" },
    // venue removed (use venue_management)
    // venue_management
    { module: "venue_management", action: "view", description: "View venue management" },
    { module: "venue_management", action: "create", description: "Create venue management" },
    { module: "venue_management", action: "edit", description: "Edit venue management" },
    { module: "venue_management", action: "delete", description: "Delete venue management" },
  ];

  for (const data of permissionData) {
    await prisma.permission.create({ data });
  }

  // Dynamically assign ALL permissions to Super Admin
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  console.log(`✅ ${permissionData.length} Permissions seeded & all assigned to Super Admin`);

  // ─── Brands ───────────────────────────────────────────────────────────────
  const brandSwn = await prisma.brand.create({ data: { name: "Swasana Venue Mastery", code: "SWN" } });
  const brandGnw = await prisma.brand.create({ data: { name: "Gunawarman Hallmark & Event", code: "GNW" } });
  const brandPbn = await prisma.brand.create({ data: { name: "Pakubuwono Event Artistry", code: "PBN" } });
  console.log("✅ 3 Brands seeded");

  // ─── Venues ───────────────────────────────────────────────────────────────
  // SWN venues: BRIN Thamrin (SBT), BRIN Gatot Subroto (SBG), Seskoad (SSK),
  //             Dharmagati (SDG), Lippo Kuningan (SLK), Patrajasa (SPJ), Grand Slipi (SGS)
  // GNW venues: Menara Bripens (GMP)
  // PBN venues: Paramita (PKP), Samisara Sopodel (GSS)
  const venueInputs = [
    { name: "BRIN Thamrin",        code: "SBT", capacity: 800, address: "Jl. M.H. Thamrin No.8, Jakarta Pusat",                  brandId: brandSwn.id },
    { name: "BRIN Gatot Subroto",  code: "SBG", capacity: 800, address: "Jl. Gatot Subroto No.10, Jakarta Selatan",               brandId: brandSwn.id },
    { name: "Seskoad",             code: "SSK", capacity: 800, address: "Jl Gatot Subroto No. 96, Bandung",                       brandId: brandSwn.id },
    { name: "Dharmagati",          code: "SDG", capacity: 800, address: "Jl. Raya Jakarta-Bogor, Jakarta Timur",                  brandId: brandSwn.id },
    { name: "Lippo Kuningan",      code: "SLK", capacity: 800, address: "Jl. HR. Rasuna Said Kav. B12, Jakarta Selatan",          brandId: brandSwn.id },
    { name: "Patrajasa",           code: "SPJ", capacity: 800, address: "Jl. Gatot Subroto No.Kav 32-34, Jakarta Selatan",        brandId: brandSwn.id },
    { name: "Grand Slipi",         code: "SGS", capacity: 800, address: "Jl. Letjen S. Parman, Jakarta Barat",                    brandId: brandSwn.id },
    { name: "Menara Bripens",      code: "GMP", capacity: 800, address: "Jl. Gatot Subroto, Jakarta Selatan",                     brandId: brandGnw.id },
    { name: "Samisara Sopodel",    code: "GSS", capacity: 800, address: "Jl.Mega Kuningan Barat III No.1-6, Jakarta Selatan",     brandId: brandPbn.id },
    { name: "Paramita",            code: "PKP", capacity: 800, address: "Jl.Boulevard Raya Sektor 7 Bintaro",                     brandId: brandPbn.id },
  ];

  const venues = [];
  for (const data of venueInputs) {
    const venue = await prisma.venue.create({ data: { ...data, isActive: true } });
    venues.push(venue);
  }
  console.log(`✅ ${venues.length} Venues seeded`);

  // ─── Payment Methods ──────────────────────────────────────────────────────
  await prisma.paymentMethod.create({
    data: {
      venueId: venues[0].id,
      bankName: "BCA",
      bankAccountNumber: "1234567890",
      bankRecipient: "PT Swasana Venue Mastery",
    },
  });
  console.log("✅ 1 Payment Method seeded");

  // ─── Payment Methods (Venue) ──────────────────────────────────────────────
  await prisma.paymentMethod.create({
    data: {
      venueId: venues[0].id,
      bankName: "BCA",
      bankAccountNumber: "1234567890",
      bankRecipient: "PT Swasana Venue Mastery",
    },
  });
  console.log("✅ 1 Payment Method seeded");

  // ─── Packages + Variants ────────────────────────────────────────────────────
  const venueByCode = Object.fromEntries(venues.map((v) => [v.code, v.id]));

  const packageData: { packageName: string; venueCode: string; variants: { variantName: string; pax: number; price: number }[] }[] = [
    { packageName: "PARAMA PAKUBUWONO", venueCode: "PKP", variants: [
      { variantName: "600 pax", pax: 600, price: 271000000 },
      { variantName: "800 pax", pax: 800, price: 320000000 },
    ]},
    { packageName: "KUSUMA PAKUBUWONO", venueCode: "PKP", variants: [
      { variantName: "600 pax", pax: 600, price: 325000000 },
      { variantName: "800 pax", pax: 800, price: 368000000 },
    ]},
    { packageName: "CHROMA PACKAGE", venueCode: "PKP", variants: [
      { variantName: "800 Pax", pax: 800, price: 158800000 },
    ]},
    { packageName: "SUNDARI SOPO DEL SAMISARA", venueCode: "GSS", variants: [
      { variantName: "600 pax", pax: 600, price: 325000000 },
      { variantName: "800 pax", pax: 800, price: 372000000 },
    ]},
    { packageName: "JAYANTI SOPO DEL SAMISARA", venueCode: "GSS", variants: [
      { variantName: "600 pax", pax: 600, price: 355000000 },
      { variantName: "800 pax", pax: 800, price: 420000000 },
    ]},
    { packageName: "SUNDARI MENARA BRIPENS", venueCode: "GMP", variants: [
      { variantName: "600 pax", pax: 600, price: 299800000 },
      { variantName: "800 pax", pax: 800, price: 329800000 },
    ]},
    { packageName: "VELORA PACKAGE", venueCode: "GMP", variants: [
      { variantName: "800 Pax", pax: 800, price: 329800000 },
    ]},
    { packageName: "CHROMA PACKAGE", venueCode: "GMP", variants: [
      { variantName: "800 Pax", pax: 800, price: 299800000 },
    ]},
    { packageName: "CHROMA PACKAGE", venueCode: "SBT", variants: [
      { variantName: "800 Pax", pax: 800, price: 279800000 },
    ]},
    { packageName: "VELORA PACKAGE", venueCode: "SBT", variants: [
      { variantName: "800 Pax", pax: 800, price: 309800000 },
    ]},
    { packageName: "CHROMA PACKAGE", venueCode: "SBG", variants: [
      { variantName: "800 Pax", pax: 800, price: 269800000 },
    ]},
    { packageName: "VELORA BRIN GATSU", venueCode: "SBG", variants: [
      { variantName: "800 Pax", pax: 800, price: 299800000 },
    ]},
    { packageName: "CRHOMA BRIN GATSU", venueCode: "SBG", variants: [
      { variantName: "800 Pax", pax: 800, price: 269800000 },
    ]},
    { packageName: "BRIN GATOT PROMO", venueCode: "SBG", variants: [
      { variantName: "Chroma Package", pax: 800, price: 269800000 },
      { variantName: "Velora Package", pax: 800, price: 299800000 },
    ]},
    { packageName: "CHROMA PACKAGE", venueCode: "SSK", variants: [
      { variantName: "800 Pax", pax: 800, price: 319800000 },
    ]},
    { packageName: "VELORA PACKAGE", venueCode: "SSK", variants: [
      { variantName: "800 Pax", pax: 800, price: 349800000 },
    ]},
    { packageName: "CHROMA PACKAGE", venueCode: "SDG", variants: [
      { variantName: "800 Pax", pax: 800, price: 229800000 },
    ]},
    { packageName: "VELORA PACKAGE", venueCode: "SDG", variants: [
      { variantName: "1000 Pax", pax: 1000, price: 318800000 },
    ]},
    { packageName: "AURORA PACKAGE", venueCode: "SDG", variants: [
      { variantName: "1000", pax: 1000, price: 358800000 },
      { variantName: "Paket 2 ", pax: 600, price: 150000000 },
      { variantName: "Paket 3", pax: 300, price: 100000000 },
    ]},
    { packageName: "CHROMA PACKAGE", venueCode: "SLK", variants: [
      { variantName: "1000 Pax", pax: 1000, price: 268800000 },
    ]},
  ];

  for (const pkg of packageData) {
    const createdPkg = await prisma.package.create({
      data: {
        packageName: pkg.packageName,
        available: true,
        venueId: venueByCode[pkg.venueCode],
        notes: "",
      },
    });
    for (const v of pkg.variants) {
      await prisma.packageVariant.create({
        data: {
          packageId: createdPkg.id,
          variantName: v.variantName,
          pax: v.pax,
          price: v.price,
          available: true,
        },
      });
    }
  }
  console.log(`✅ ${packageData.length} Packages with variants seeded`);

  // ─── Admin User ───────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("Admin@1234", 12);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@swasana.com",
      name: "Administrator",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  const adminProfile = await prisma.profile.create({
    data: {
      userId: adminUser.id,
      email: adminUser.email,
      fullName: "Administrator",
      roleId: adminRole.id,
      dataScope: "all",
      status: ProfileStatus.active,
      isEmailVerified: true,
      mustChangePassword: false,
    },
  });

  // Assign admin ke SEMUA venues
  for (const v of venues) {
    await prisma.userVenueAccess.create({
      data: {
        userId: adminProfile.id,
        venueId: v.id,
        scope: "general",
      },
    });
  }

  console.log("✅ Admin user seeded: admin@swasana.com / Admin@1234");

  // ─── Vendor Categories ────────────────────────────────────────────────────
  const vendorCategoryData = [
    { name: "Catering", sortOrder: 1 },
    { name: "Foodstall Millenial", sortOrder: 2 },
    { name: "Dekorasi", sortOrder: 3 },
    { name: "Rias & Busana", sortOrder: 4 },
    { name: "Photography", sortOrder: 5 },
    { name: "Photobooth", sortOrder: 5 },
    { name: "Entertainment", sortOrder: 6 },
    { name: "Hotel", sortOrder: 8 },
    { name: "Wedding Car", sortOrder: 99 },
    { name: "MC", sortOrder: 99 },
    { name: "Honeymoon", sortOrder: 99 },
    { name: "Undangan Cetak", sortOrder: 99 },
    { name: "Undangan Digital", sortOrder: 99 },
  ];

  const catMap: Record<string, string> = {};
  for (const data of vendorCategoryData) {
    const cat = await prisma.vendorCategory.create({ data });
    catMap[data.name] = cat.id;
  }
  console.log(`✅ ${vendorCategoryData.length} Vendor Categories seeded`);

  // ─── Vendors ──────────────────────────────────────────────────────────────
  const vendorsByCat: Record<string, string[]> = {
    "Catering": [
      "EVANA CATERING", "KDM CATERING", "Tidar's Catering", "IVORY CATERING", "All In Diamond",
      "SW RITA CATERING", "RONS CATERING", "RUMAH PENGANTIN CATERING", "Alfabet Catering",
      "Kadinya Catering", "Diamond Catering", "TONNY'S CATERING", "POLA CATERING",
      "BAYEM 11 CATERING", "LEGURI CATERING", "ALINEA CATERING", "ALAMANDA CATERING",
      "BALTIMORE CATERING", "Kiki Catering", "YANTIRA CATERING", "RISYA CATERING",
      "Ananda Catering", "Ibu Djoko Catering", "Puspita Sawargi Catering", "VAN HENGEL CATERING",
      "Sono Kembang Catering", "MINITY CATERING", "PERFECT CATERING", "MINA CATERING",
      "SEKAYU CATERING", "MORASARI CATERING", "Dwi Tunggal Citra Catering", "SAMUDRA CATERING",
      "DESTINY CATERING", "CELDI CATERING", "ROEMAH CITRA", "Yvonnes Catering",
      "YUFETO CATERING", "Puspa Catering", "MUTIARA GARUDA CATERING", "ASPARAGUS CATERING",
      "ALBANYA CATERING",
    ],
    "Dekorasi": [
      "SORAI DEKORASI", "VALENTINE DEKORASI", "ARDI DEKORASI", "Amazing Dekorasi",
      "Djusmasri Dekorasi", "MICHELLE PARIS DEKORASI", "AKSEN DEKORASI", "MENATA DEKORASI",
      "PESONA ALAMANDA", "Janji Dekorasi", "ALBEERTO SITANGGANG DEKORASI", "SPECHELLE DEKORASI",
      "Innovasi Dekorasi", "WHITE PEARL", "Bayau - Bayau Dekorasi", "Brassica Dekorasi",
      "KAYUKU DEKORASI", "SANGGAR GANTOSORI DEKORASI", "SMILE DEKORASI", "The Moon Dekorasi",
      "ATELMA BOTTING DEKORASI", "BACHMAN DEKORASI", "GALENI DEKORASI", "SECRET DEKORASI",
      "Dinda Sakato Dekorasi", "SARAS DEKORASI", "KALOSA DEKORASI", "LIA WEDDING DEKORASI",
      "LAVAGOLD DEKORASI", "FLORKA DEKORASI", "DVALUE DEKORASI", "Diamond Dekorasi",
      "RAFAFI DEKORASI", "NICCATELIER", "ALINEA DEKORASI", "Sangrida Sriwijaya Dekorasi",
      "NEMI NS DEKORASI", "Arrya Dekorasi", "ACCORD DEKORASI", "SYARIEF DEKORASI",
      "ROSEGOLD DEKORASI", "JK TENT & DEKORASI", "Djati Dekorasi", "CALLISTA DEKORASI",
      "RATU DEKORASI", "Wonderful Decor",
    ],
    "Photography": [
      "Imagenic Photography", "ANTARA RASA PHOTOGRAPHY", "PIC PICTURES", "FLOWIE PROJECT",
      "ANASTASIA PHOTOGRAPHY", "AR Photography", "FRAGMEN CERITA PHOTOGRAPHY",
      "KALAPOTERA PHOTOGRAPHY", "THE PHOTOMOTO PHOTOGRAPHY", "Mirza Photography",
      "TEINMIERE PHOTOGRAPHY", "ANANTHA PROJECT", "HIJAZ PHOTOGRAPHY", "NANOLALA PHOTOGRAPHY",
      "AMOR PHOTOGRAPHY", "STUDIO KENCANA PHOTOGRAPHY", "MEGRASHY PHOTOGRAPHY",
      "KATA KITA PHOTOGRAPHY", "ASKAR PHOTOGRAPHY", "Alexo Photography", "ARSENT PHOTOGRAPHY",
      "KASSANDRA PHOTOGRAPHY", "JAVA PHOTOGRAPHY", "IKIGAI PHOTOGRAPHY", "ALURA PHOTOGRAPHY",
      "KAIROS PHOTOGRAPHY", "CLASSIGRAF PHOTOGRAPHY", "PIXEL", "INCORE PHOTOGRAPHY",
      "THE EXOMOTO PHOTOGRAPHY", "Inspirasa Photography", "CAKAPICT PHOTOGRAPHY",
      "MEKKANIKA PHOTOGRAPHY", "CLINOVIC PHOTOGRAPHY", "NESNUMOTO PHOTOGRAPHY",
      "ATTARKHA PHOTOGRAPHY", "GELISENJA",
    ],
    "Entertainment": [
      "SKY WEDDING ENTERTAINMENT", "SEISARTE", "MATTHEW ENTERTAINMENT", "David Entertainment",
      "Taman Musik Entertainment", "HARMONIC ENTERTAIMENT", "KOF ENTERTAINMENT",
      "FARAMO ENTERTAINMENT", "PUTRA MAHKOTA ENTERTAINMENT", "REDVELVET ENTERTAINMENT",
      "WIJAYA ENTERTAINMENT", "CIKALIA ENTERTAINMENT", "TAF Entertainment",
      "KENNY JO ENTERTAINMENT", "Barva Entertainment", "NANANG ENTERTAINMENT",
    ],
    "Rias & Busana": [
      "LUCKY HAKIM MUA", "GENDIS WARNA RIAS", "SANGGAR GANTOSORI RIAS & BUSANA",
      "ARMEITA MUA", "SADIQA MUA", "Sangrida Sriwijaya Rias & Busana", "DEWI TIAN RIAS",
      "ERNADE MUA", "GUGI NUGRAHA", "AYUNG BERINDA RIAS", "CHANDRA ROEMAH MANTEN RIAS & BUSANA",
      "PANDJI RAMDANI MUA", "GRIYA ARISTY RIAS & BUSANA", "Talitha Rias & Busana",
      "Kusumo Inten Rias & Busana", "NELLA MULYA MUA", "LABANA RIAS", "NAIRE MUA",
      "ROEMAH ADITYA", "RIFQA WIDYA MUA", "IVAN BELVA RIAS", "LAVIENNA RIAS",
      "Putisarah Rias & Busana", "Hera Griya Rias & Busana", "Aluira Rias & Busana",
      "ANUGRAH WEDDING", "Diamond Rias & Busana", "Redberry Rias & Busana",
      "YULI YUNANI MUA", "RADEN ANNISA RIAS", "Dinda Sakato Rias & Busana",
      "MR By Miarosa Rias & Busana", "Sanggar Jihan Rias & Busana", "SANGGAR VIOLETTA",
      "Nilasari Rias & Busana", "SANGGAR LIZA", "SANGGAR KINANG", "TIKA KUSNAEDI MUA",
      "MELATI GRIYA PENGANTIN RIAS & BUSANA", "Djusmasri Rias & Busana",
      "ATELMA BOTTING RIAS & BUSANA", "UTI GUNAWAN RIAS & BUSANA", "YULLY MUA",
      "AJENG PUSVITA MUA", "AMBUN SURI RIAS", "ANIS RINJANI RIAS & BUSANA",
      "DEA MUA", "YAYAN BUSANA",
    ],
    "Photobooth": [
      "JB Photobooth", "My Moment PHOTOBOOTH", "DEMOOI PHOTOBOOTH", "PHOTOMATICS PHOTOBOOTH",
    ],
    "Wedding Car": [
      "RAKA WEDDING CAR", "KEN'S WEDDING CAR", "FENDI WEDDING CAR", "DANU WEDDING CAR",
    ],
    "Foodstall Millenial": [
      "RIYAN F&B Sejahtera", "VILO GELATO", "CHATIME", "MAXX COFFEE", "KOPI KENANGAN",
      "D'CREPES", "Named",
    ],
    "Undangan Digital": ["VIDING.CO"],
    "Hotel": ["Aviary Bintaro"],
  };

  let vendorCount = 0;
  for (const [catName, vendors] of Object.entries(vendorsByCat)) {
    const categoryId = catMap[catName];
    if (!categoryId) continue;
    for (const name of vendors) {
      await prisma.vendor.create({ data: { name, categoryId } });
      vendorCount++;
    }
  }
  console.log(`✅ ${vendorCount} Vendors seeded`);

  // ─── User Groups ──────────────────────────────────────────────────────────
  const userGroupData = [
    { name: "Team Ronce Melati", sortOrder: 0, createdBy: adminProfile.id },
    { name: "Team Sedap Malam", sortOrder: 1, createdBy: adminProfile.id },
    { name: "Team Matahari", sortOrder: 2, createdBy: adminProfile.id },
    { name: "Team Anggrek", sortOrder: 3, createdBy: adminProfile.id },
    { name: "Team Mawar", sortOrder: 4, createdBy: adminProfile.id },
    { name: "Team MICE", sortOrder: 5, createdBy: adminProfile.id },
  ];

  for (const data of userGroupData) {
    await prisma.userGroup.create({ data });
  }
  console.log(`✅ ${userGroupData.length} User Groups seeded`);

  console.log("\n🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
