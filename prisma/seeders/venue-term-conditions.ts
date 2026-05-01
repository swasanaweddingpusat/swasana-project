import { prisma } from "./_client";

const PARAMITA_TC = `<p><strong>TERM &amp; CONDITION</strong></p>
<ol>
<li>Keseluruhan ketentuan yang tercantum di Purchase Order ini, bersifat mengikat dan wajib dilaksanakan oleh pihak penyelenggara dan penyewa.</li>
<li>Para pihak sepakat bahwa booking fee merupakan tanda jadi dan bersifat non-refundable. Oleh karena itu, apabila terjadi pembatalan oleh Pihak Penyewa setelah pembayaran booking fee, maka dana tersebut tidak dapat dikembalikan, dan ketentuan ini telah dipahami serta disetujui oleh Pihak Penyewa tanpa adanya paksaan dari pihak manapun.</li>
<li>Apabila terjadi pembatalan oleh pihak penyewa dalam waktu 3 bulan atau kurang dari 3 bulan sebelum acara, maka dana yang dapat dikembalikan adalah sebesar 50% dari dana masuk booking fee awal.</li>
<li>Apabila terjadi pembatalan oleh pihak penyewa dalam waktu 4 sampai 7 bulan sebelum acara, maka dana yang dapat dikembalikan adalah sebesar 20% dari dana keseluruhan yang telah masuk.</li>
<li>Apabila terjadi pembatalan oleh pihak penyewa dalam waktu 8 sampai 12 bulan sebelum acara, maka dana yang dapat dikembalikan adalah sebesar 40% dari dana keseluruhan yang telah masuk.</li>
<li>Apabila terjadi pembatalan oleh pihak penyewa dalam waktu diatas 1 tahun sebelum acara, maka dana yang dapat dikembalikan adalah sebesar 50% dari dana keseluruhan yang telah masuk.</li>
<li>Apabila pembatalan terjadi dikarenakan calon pengantin meninggal dunia, maka dana yang telah masuk dapat dikembalikan sebesar 25% dari dana yang telah masuk.</li>
<li>Apabila hingga sampai 1 (satu) bulan sebelum acara pernikahan berlangsung, tidak memungkinan untuk mengadakan acara karena adanya kebijakan Pemerintah, maka kami persilahkan kepada pihak penyewa untuk reschedule acara dan memilih tanggal sesuai dengan tanggal yang masih available.</li>
<li>Kepastian penentuan tanggal maksimal 2 (dua) minggu setelah booking fee selama tanggal yang diinginkan masih available.</li>
<li>Perubahan atau pergeseran tanggal lebih dari 1 (satu) bulan setelah booking fee dikenakan biaya tambahan 100% dari booking fee sebesar Rp 5.000.000,- (Lima Juta Rupiah).</li>
<li>Pembayaran Down Payment kepada vendor-vendor pilihan akan dilaksanakan setelah pembayaran Angsuran 2 (masuk dana sebesar Rp 90.000.000,-).</li>
<li>Prosesi acara Akad Nikah/Teapai dikenakan biaya sebesar Rp 5.000.000,- (lima juta rupiah).</li>
<li>Apabila terjadi kondisi yang tidak diinginkan seperti kondisi mati lampu diluar kesalahan pihak penyelenggara seperti pemadaman listrik dari pihak PLN, kebanjiran, kebakaran, dan lainya di area sekitar yang berdampak pemadaman listrik, Pihak penyewa akan membebaskan penyelenggara dari segala tuntutan atau ganti rugi sehubungan dengan dampak dari kondisi tersebut. Pihak penyelenggara akan berupaya menggunakan genset dan mengambil tindakan yang diperlukan agar acara Pihak Penyewa pada hari-H dapat berjalan lancar.</li>
<li>Kehilangan atau kerusakan terhadap barang yang dibawa oleh tamu undangan atau pemangku hajat pada saat pesta berlangsung bukan merupakan tanggung jawab pihak pengelola gedung (THE PAKUBUWONO EVENT ARTISTRY).</li>
<li>Apabila ditemukan pihak keluarga atau tamu undangan yang merokok di area terlarang (Ballroom, Lobby, Ruang Rias, Backstage, Area Publik Indoor) maka akan dikenakan denda sebesar Rp 2.000.000,- per kejadian. Denda dibebankan kepada Pihak Client sebagai penyelenggara acara.</li>
<li>Apabila terdapat adanya kelalaian dari Client dalam penggunaan peralatan maupun fasilitas gedung dan mengakibatkan terjadinya kerusakan pada Ballroom atau area Gedung, maka segala biaya yang timbul menjadi tanggung jawab Pihak Kedua, sebesar Rp 5.000.000,-/m2 (meter persegi).</li>
<li>Diperbolehkan membawa makanan &amp; minuman dari luar (hanya yang tidak tersedia pada vendor catering) dan akan dikenakan charge tambahan sebesar Rp 10.000,-/1 porsinya dan hanya maksimal 1 jenis makanan dengan maksimum 200 porsi.</li>
<li>Bila terjadi kerusakan di lingkungan THE PAKUBUWONO EVENT ARTISTRY - Graha Paramita II Grand Ballroom yang dikarenakan vendor tidak rekanan dengan THE PAKUBUWONO EVENT ARTISTRY atau yang diperbuat oleh pihak keluarga, menjadi tanggung jawab pihak penyewa dan akan dikompensasikan maksimal 3 (tiga) hari setelah acara berlangsung. Pihak Penyewa akan bertanggung jawab atas hal sepanjang pihak Penyelenggara dapat membuktikan bahwa kerusakan tersebut memang disebabkan oleh Pihak Penyewa. Pihak Penyelenggara akan bertanggung jawab terhadap kerusakan di lingkungan THE PAKUBUWONO EVENT ARTISTRY - Graha Paramita II Grand Ballroom yang diakibatkan oleh pihak atau vendor rekanan dari pihak Penyelenggara serta akan membebaskan penyewa dari segala tuntutan atau ganti rugi sehubungan dengan kerusakan tersebut.</li>
<li>Untuk penambahan waktu acara dikenakan biaya sebesar Rp 6.000.000 per jam nya untuk acara yang menggunakan gedung THE PAKUBUWONO EVENT ARTISTRY - Graha Paramita II Grand Ballroom.</li>
<li>Banquet Order (BO) Pemesanan makanan dari vendor catering yang diakui secara resmi adalah yang dikeluarkan oleh pihak THE PAKUBUWONO EVENT ARTISTRY.</li>
<li>Complimentary berupa honeymoon atau hotel dapat digunakan dengan waktu maksimal 1 (satu) bulan setelah acara berlangsung. Apabila penggunaan dilakukan pada waktu high seasons maka client bersedia membayarkan additional surcharge.</li>
<li>Seluruh complimentary tidak dapat dialihkan dalam items lain dan tidak dapat ditukarkan dalam bentuk uang. Serta berhak didapatkan oleh client apabila telah menyelesaikan pelunasan wedding package.</li>
<li>Demikian Surat Purchase Order ini dibuat oleh para pihak dengan keadaan sehat, tanpa paksaan dari pihak manapun. Serta mempunyai kekuatan hukum yang mengikat bagi para pihak. Apabila di kemudian hari salah satu pihak melanggar ketentuan diatas, maka Surat ini akan menjadi bukti yang sah di mata hukum. Segala perubahan terhadap Type Pembayaran dan Term &amp; Condition akan disepakati bersama serta dituangkan dalam suatu Addendum yang merupakan bagian yang tidak terpisahkan dari Purchase Order ini.</li>
<li>Para Pihak dengan ini mengemban Hak dan Kewajiban sebagai berikut:</li>
</ol>
<p><strong>Penyewa</strong></p>
<ol>
<li>Berhak untuk mendapatkan fasilitas dan layanan sebagaimana yang disepakati dalam Purchase Order.</li>
<li>Berhak untuk meminta konsultasi baik secara lisan ataupun tertulis sejak pembayaran Booking fee sampai dengan acara pada Hari–H.</li>
<li>Berkewajiban untuk melakukan pembayaran kepada pihak Penyelenggara sesuai dengan syarat dan ketentuan yang disepakati dalam Purchase Order.</li>
<li>Berkewajiban untuk mematuhi ketentuan yang berlaku di lingkungan Penyelenggara ketika acara berlangsung.</li>
</ol>
<p><strong>Penyelenggara</strong></p>
<ol>
<li>Berhak untuk mendapatkan sejumlah pembayaran sesuai dengan syarat dan ketentuan yang disepakati dalam Purchase Order.</li>
<li>Berkewajiban untuk memberikan fasilitas dan layanan kepada Penyewa sebagaimana yang disepakati dalam Purchase Order.</li>
<li>Berkewajiban untuk memberikan informasi sebenar-benarnya terkait jumlah tamu undangan dan kesepakatan atas penambahan item pernikahan dengan pihak vendor demi kelancaran dan suksesnya penyelenggaraan acara.</li>
</ol>
<p><strong>ATURAN PEMBAYARAN</strong></p>
<p><strong>1. Jadwal Pembayaran</strong></p>
<ul>
<li>Booking Fee sebesar Rp 5.000.000,- (Lima Juta Rupiah)</li>
<li>Down Payment sebesar Rp 30.000.000,- (Tiga Puluh Juta Rupiah) — 2 minggu setelah Booking Fee</li>
<li>Angsuran tahap 1 sebesar Rp 30.000.000,- (Tiga Puluh Juta Rupiah) — satu bulan setelah melakukan DP</li>
<li>Angsuran tahap 2 sebesar Rp 30.000.000,- (Tiga Puluh Juta Rupiah) — satu bulan setelah melakukan Angsuran 1</li>
<li>Angsuran tahap 3 sebesar Rp 50.000.000,- (Lima Puluh Juta Rupiah) — satu bulan setelah melakukan Angsuran 2</li>
<li>Term Pelunasan tahap 1 sebesar Rp 65.000.000,- (Enam Puluh Lima Juta Rupiah) — satu bulan setelah melakukan Angsuran 3 (nominal dapat berubah sesuai dengan harga paket)</li>
<li>Term Pelunasan tahap 2 sebesar Rp 60.000.000,- (Enam Puluh Juta Rupiah) — satu bulan setelah melakukan Term Pelunasan 1</li>
<li>Pelunasan sebesar Rp 118.000.000,- (Seratus Delapan Belas Juta Rupiah) — (nominal dapat berubah sesuai dengan pilihan paket dan vendor) paling lambat dibayarkan 2 (dua) bulan sebelum tanggal acara pernikahan, apabila tidak terselesaikan sampai dengan Hari-H, pengelola berhak membatalkan acara secara sepihak.</li>
</ul>
<p><strong>2. Metode Pembayaran</strong></p>
<ul>
<li>Untuk setiap reminder jadwal pembayaran jatuh tempo, akan dibantu oleh Finance THE PAKUBUWONO yang akan menghubungi via telepon dan whatsapp setiap 1 minggu sebelum jatuh tempo.</li>
<li>Pembayaran dapat dilakukan melalui transfer bank atau tunai.</li>
<li>Untuk pembayaran tunai (hanya di office representative Graha Paramita II The Pakubuwono Ballroom). Dengan membuat appointment terlebih dahulu dengan Finance Resmi, Manager Sales dan Event Specialist.</li>
<li>Untuk transfer bank, hanya melalui nomer rekening yang tercantum dalam invoice yang diterbitkan oleh Finance Resmi setiap 1 minggu sebelum jatuh tempo pembayaran terjadwal.</li>
</ul>
<p><strong>3. Konfirmasi Pembayaran</strong></p>
<ul>
<li>PIC Finance Resmi untuk Graha Paramita II The Pakubuwono Grand Ballroom: Rosita — 0811 8884 481</li>
<li>Invoice resmi yang diterbitkan oleh Finance Resmi harus yang sudah di authorized oleh Finance THE PAKUBUWONO EVENT ARTISTRY (tercantum tanda tangan digital).</li>
<li>Setiap Invoice akan dikirimkan oleh Finance Resmi melalui whatsapp group persiapan pernikahan.</li>
<li>Setiap pembayaran harus dilengkapi dengan bukti pembayaran yang dikirim melalui whatsapp group pernikahan.</li>
</ul>
<p><strong>4. Pembayaran Additional Vendor</strong></p>
<ul>
<li>Pihak Penyewa wajib menginfokan terkait segala penambahan/upgrade Catering, Dekorasi dan Entertainment kepada THE PAKUBUWONO EVENT ARTISTRY.</li>
<li>Seluruh pembayaran atas penambahan charge vendor / upgrade penambahan porsi Catering / Dekorasi dan Entertainment dibayarkan setelah menerima invoice dari Finance resmi THE PAKUBUWONO EVENT ARTISTRY, apabila pembayaran dilakukan sebelum diberikan invoice oleh pihak Finance Resmi THE PAKUBUWONO EVENT ARTISTRY, maka segala konsekuensi yang timbul tidak menjadi tanggung jawab THE PAKUBUWONO EVENT ARTISTRY.</li>
</ul>
<p><strong>5. Ketentuan Lain</strong></p>
<ul>
<li>Jika keterlambatan pembayaran melebihi 14 hari, layanan akan dihentikan sementara.</li>
<li>Apabila pihak penyewa tidak memberikan konfirmasi baik lisan maupun tulisan mengenai rencana tanggal pernikahan dan tidak melakukan pembayaran selama 30 hari dari tanggal invoice diterbitkan, maka pihak THE PAKUBUWONO EVENT ARTISTRY berhak membatalkan atau memberikan tanggal tersebut ke calon pengantin lain dan dana telah masuk dapat dikembalikan 50% dari nominal booking fee awal.</li>
</ul>`;

export async function seedVenueTermConditions() {
  const venue = await prisma.venue.findFirst({ where: { code: "GP2" } });
  if (!venue) {
    console.log("⚠️  Venue Paramita (GP2) not found — skip T&C seed");
    return;
  }

  await prisma.venue.update({
    where: { id: venue.id },
    data: { termAndCondition: PARAMITA_TC },
  });

  console.log("✅ Term & Condition seeded for Paramita (GP2)");
}

// Run standalone
if (process.argv[1].includes("venue-term-conditions")) {
  seedVenueTermConditions()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
