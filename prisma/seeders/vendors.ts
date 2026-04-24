import { prisma } from "./_client";

export async function seedVendors() {
  const vendorCategoryData = [
    { name: "Catering", sortOrder: 1 }, { name: "Foodstall Millenial", sortOrder: 2 },
    { name: "Dekorasi", sortOrder: 3 }, { name: "Rias & Busana", sortOrder: 4 },
    { name: "Photography", sortOrder: 5 }, { name: "Photobooth", sortOrder: 5 },
    { name: "Entertainment", sortOrder: 6 }, { name: "Hotel", sortOrder: 8 },
    { name: "Wedding Car", sortOrder: 99 }, { name: "MC", sortOrder: 99 },
    { name: "Honeymoon", sortOrder: 99 }, { name: "Undangan Cetak", sortOrder: 99 },
    { name: "Undangan Digital", sortOrder: 99 },
  ];

  const catMap: Record<string, string> = {};
  for (const data of vendorCategoryData) {
    const existing = await prisma.vendorCategory.findUnique({ where: { name: data.name } });
    const cat = existing ?? await prisma.vendorCategory.create({ data });
    catMap[data.name] = cat.id;
  }
  console.log(`✅ ${vendorCategoryData.length} Vendor Categories seeded`);

  const vendorsByCat: Record<string, string[]> = {
    "Catering": ["EVANA CATERING","KDM CATERING","Tidar's Catering","IVORY CATERING","All In Diamond","SW RITA CATERING","RONS CATERING","RUMAH PENGANTIN CATERING","Alfabet Catering","Kadinya Catering","Diamond Catering","TONNY'S CATERING","POLA CATERING","BAYEM 11 CATERING","LEGURI CATERING","ALINEA CATERING","ALAMANDA CATERING","BALTIMORE CATERING","Kiki Catering","YANTIRA CATERING","RISYA CATERING","Ananda Catering","Ibu Djoko Catering","Puspita Sawargi Catering","VAN HENGEL CATERING","Sono Kembang Catering","MINITY CATERING","PERFECT CATERING","MINA CATERING","SEKAYU CATERING","MORASARI CATERING","Dwi Tunggal Citra Catering","SAMUDRA CATERING","DESTINY CATERING","CELDI CATERING","ROEMAH CITRA","Yvonnes Catering","YUFETO CATERING","Puspa Catering","MUTIARA GARUDA CATERING","ASPARAGUS CATERING","ALBANYA CATERING"],
    "Dekorasi": ["SORAI DEKORASI","VALENTINE DEKORASI","ARDI DEKORASI","Amazing Dekorasi","Djusmasri Dekorasi","MICHELLE PARIS DEKORASI","AKSEN DEKORASI","MENATA DEKORASI","PESONA ALAMANDA","Janji Dekorasi","ALBEERTO SITANGGANG DEKORASI","SPECHELLE DEKORASI","Innovasi Dekorasi","WHITE PEARL","Bayau - Bayau Dekorasi","Brassica Dekorasi","KAYUKU DEKORASI","SANGGAR GANTOSORI DEKORASI","SMILE DEKORASI","The Moon Dekorasi","ATELMA BOTTING DEKORASI","BACHMAN DEKORASI","GALENI DEKORASI","SECRET DEKORASI","Dinda Sakato Dekorasi","SARAS DEKORASI","KALOSA DEKORASI","LIA WEDDING DEKORASI","LAVAGOLD DEKORASI","FLORKA DEKORASI","DVALUE DEKORASI","Diamond Dekorasi","RAFAFI DEKORASI","NICCATELIER","ALINEA DEKORASI","Sangrida Sriwijaya Dekorasi","NEMI NS DEKORASI","Arrya Dekorasi","ACCORD DEKORASI","SYARIEF DEKORASI","ROSEGOLD DEKORASI","JK TENT & DEKORASI","Djati Dekorasi","CALLISTA DEKORASI","RATU DEKORASI","Wonderful Decor"],
    "Photography": ["Imagenic Photography","ANTARA RASA PHOTOGRAPHY","PIC PICTURES","FLOWIE PROJECT","ANASTASIA PHOTOGRAPHY","AR Photography","FRAGMEN CERITA PHOTOGRAPHY","KALAPOTERA PHOTOGRAPHY","THE PHOTOMOTO PHOTOGRAPHY","Mirza Photography","TEINMIERE PHOTOGRAPHY","ANANTHA PROJECT","HIJAZ PHOTOGRAPHY","NANOLALA PHOTOGRAPHY","AMOR PHOTOGRAPHY","STUDIO KENCANA PHOTOGRAPHY","MEGRASHY PHOTOGRAPHY","KATA KITA PHOTOGRAPHY","ASKAR PHOTOGRAPHY","Alexo Photography","ARSENT PHOTOGRAPHY","KASSANDRA PHOTOGRAPHY","JAVA PHOTOGRAPHY","IKIGAI PHOTOGRAPHY","ALURA PHOTOGRAPHY","KAIROS PHOTOGRAPHY","CLASSIGRAF PHOTOGRAPHY","PIXEL","INCORE PHOTOGRAPHY","THE EXOMOTO PHOTOGRAPHY","Inspirasa Photography","CAKAPICT PHOTOGRAPHY","MEKKANIKA PHOTOGRAPHY","CLINOVIC PHOTOGRAPHY","NESNUMOTO PHOTOGRAPHY","ATTARKHA PHOTOGRAPHY","GELISENJA"],
    "Entertainment": ["SKY WEDDING ENTERTAINMENT","SEISARTE","MATTHEW ENTERTAINMENT","David Entertainment","Taman Musik Entertainment","HARMONIC ENTERTAIMENT","KOF ENTERTAINMENT","FARAMO ENTERTAINMENT","PUTRA MAHKOTA ENTERTAINMENT","REDVELVET ENTERTAINMENT","WIJAYA ENTERTAINMENT","CIKALIA ENTERTAINMENT","TAF Entertainment","KENNY JO ENTERTAINMENT","Barva Entertainment","NANANG ENTERTAINMENT"],
    "Rias & Busana": ["LUCKY HAKIM MUA","GENDIS WARNA RIAS","SANGGAR GANTOSORI RIAS & BUSANA","ARMEITA MUA","SADIQA MUA","Sangrida Sriwijaya Rias & Busana","DEWI TIAN RIAS","ERNADE MUA","GUGI NUGRAHA","AYUNG BERINDA RIAS","CHANDRA ROEMAH MANTEN RIAS & BUSANA","PANDJI RAMDANI MUA","GRIYA ARISTY RIAS & BUSANA","Talitha Rias & Busana","Kusumo Inten Rias & Busana","NELLA MULYA MUA","LABANA RIAS","NAIRE MUA","ROEMAH ADITYA","RIFQA WIDYA MUA","IVAN BELVA RIAS","LAVIENNA RIAS","Putisarah Rias & Busana","Hera Griya Rias & Busana","Aluira Rias & Busana","ANUGRAH WEDDING","Diamond Rias & Busana","Redberry Rias & Busana","YULI YUNANI MUA","RADEN ANNISA RIAS","Dinda Sakato Rias & Busana","MR By Miarosa Rias & Busana","Sanggar Jihan Rias & Busana","SANGGAR VIOLETTA","Nilasari Rias & Busana","SANGGAR LIZA","SANGGAR KINANG","TIKA KUSNAEDI MUA","MELATI GRIYA PENGANTIN RIAS & BUSANA","Djusmasri Rias & Busana","ATELMA BOTTING RIAS & BUSANA","UTI GUNAWAN RIAS & BUSANA","YULLY MUA","AJENG PUSVITA MUA","AMBUN SURI RIAS","ANIS RINJANI RIAS & BUSANA","DEA MUA","YAYAN BUSANA"],
    "Photobooth": ["JB Photobooth","My Moment PHOTOBOOTH","DEMOOI PHOTOBOOTH","PHOTOMATICS PHOTOBOOTH"],
    "Wedding Car": ["RAKA WEDDING CAR","KEN'S WEDDING CAR","FENDI WEDDING CAR","DANU WEDDING CAR"],
    "Foodstall Millenial": ["RIYAN F&B Sejahtera","VILO GELATO","CHATIME","MAXX COFFEE","KOPI KENANGAN","D'CREPES","Named"],
    "Undangan Digital": ["VIDING.CO"],
    "Hotel": ["Aviary Bintaro"],
  };

  let vendorCount = 0;
  for (const [catName, vendors] of Object.entries(vendorsByCat)) {
    const categoryId = catMap[catName];
    if (!categoryId) continue;
    for (const name of vendors) {
      const existing = await prisma.vendor.findFirst({ where: { name, categoryId } });
      if (!existing) { await prisma.vendor.create({ data: { name, categoryId } }); }
      vendorCount++;
    }
  }
  console.log(`✅ ${vendorCount} Vendors seeded`);
}

// Run standalone
if (process.argv[1].includes("vendors")) {
  seedVendors()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
