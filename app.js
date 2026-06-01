const firebaseConfig = {
    apiKey: "AIzaSyD4c2whFEFrVKEe3YRwevxrp0SXNzzcNO4",
    authDomain: "zamanlamali-kilit.firebaseapp.com",
    databaseURL: "https://zaman-sinirlamali-kilit-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "zamanlamali-kilit",
    storageBucket: "zamanlamali-kilit.firebasestorage.app"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let aktifKullanici = null;
let seciliTalepId = "";
let silinecekKayit = { tip: null, key: null, ekstra: null }; 
let dbKullanicilari = {}; 
let globalLoglar = []; 
let sDurum = { manuel_bakim: false, zamanli_bakim: false, baslangic: 0, bitis: 0, mesaj: "SISTEM BAKIMDA" };

function tamIsim(u) {
    if(!u) return "Bilinmiyor";
    return (u.ad + (u.soyad ? " " + u.soyad : "")).trim();
}

function turkcelestir(metin) {
    if (!metin) return "";
    const temizMetin = metin.toString().trim().toUpperCase();
    
    const sozluk = {
        "ICERIDEN CIKIS": "İçeriden Çıkış",
        "BASARILI GIRIS": "Başarılı Giriş",
        "HATALI GIRIS": "Hatalı Giriş",
        "MANUEL CIKIS": "Manuel Çıkış",
        "BASARILI": "Başarılı",
        "HATALI": "Hatalı",
        "SURESI DOLMUS": "Süresi Dolmuş",
        "SURESI DOLMUS GIRIS": "Süresi Dolmuş Giriş",
        "TANIMSIZ SIFRE": "Tanımsız Şifre",
        "ZAMANLI BAKIM AKTIF": "Sistem Zamanlı Bakımda",
        "MANUEL BAKIM AKTIF": "Sistem Bakımda",
        "SIFRE IPTALI": "Şifre İptali",
        "MANUEL IPTAL": "Yönetici Tarafından İptal Edildi"
    };
    return sozluk[temizMetin] || metin; 
}

function formatGuzelTarihDisplay(rawDate) {
    if (!rawDate) return "";
    let dStr = rawDate.replace('T', ' ').replace(/\./g, ':');
    
    if (dStr.includes('-')) {
       const parts = dStr.split(' ');
       if(parts.length === 2){
          const dateP = parts[0].split('-');
          if(dateP.length === 3){
             return `${dateP[2]}/${dateP[1]}/${dateP[0]} &nbsp;⏳&nbsp; ${parts[1]}`;
          }
       }
    }
    
    const mParts = dStr.split(' ');
    if (mParts.length === 2) {
       return `${mParts[0]} &nbsp;⏳&nbsp; ${mParts[1]}`;
    }
    return dStr;
}

function stringToUnix(dateString) {
    if(!dateString) return null;
    let cleanStr = dateString.replace('T', ' ').replace(/\./g, ':');

    if (cleanStr.includes('-')) {
        const parts = cleanStr.split(' ');
        if(parts.length === 2){
            const dp = parts[0].split('-');
            const tp = parts[1].split(':');
            if(dp.length === 3 && tp.length === 2){
                const d = new Date(Number(dp[0]), Number(dp[1]) - 1, Number(dp[2]), Number(tp[0]), Number(tp[1]));
                return Math.floor(d.getTime() / 1000);
            }
        }
    }

    const parts = cleanStr.split(' ');
    if(parts.length === 2) {
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        if(dateParts.length === 3 && timeParts.length === 2) {
            const d = new Date(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]), Number(timeParts[0]), Number(timeParts[1]));
            return Math.floor(d.getTime() / 1000);
        }
    }
    return null;
}

function stringToInputFormat(dateString) {
    if (!dateString) return "";
    let cleanStr = dateString.replace('T', ' ').replace(/\./g, ':');
    if (cleanStr.includes('-')) return cleanStr.replace(' ', 'T');
    if (cleanStr.includes('/')) {
        const parts = cleanStr.split(' ');
        if(parts.length === 2) {
            const dateParts = parts[0].split('/');
            if(dateParts.length === 3) {
                return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}`;
            }
        }
    }
    return "";
}

database.ref('kullanicilar').on('value', (snap) => {
    dbKullanicilari = snap.val() || {};
    if (document.getElementById('admin-personel-body')) personelleriListele();
});

database.ref('sistem_durumu').on('value', (snap) => {
    if(snap.val()) {
        sDurum = snap.val();
        uiBakimGuncelle();
    }
});

function uiBakimGuncelle() {
    const btnM = document.getElementById("btn-manuel-bakim");
    const yaziM = document.getElementById("manuel-durum-yazi");
    const btnZ = document.getElementById("btn-zamanli-bakim-toggle");
    const inBas = document.getElementById("bakim-baslangic");
    const inBit = document.getElementById("bakim-bitis");
    const msjM = document.getElementById("manuel-bakim-mesaji");
    const msjZ = document.getElementById("zamanli-bakim-mesaji");
    
    const aktifBakimBilgisi = document.getElementById("aktif-zamanli-bakim-bilgisi");
    const zamanliBakimTarihleri = document.getElementById("zamanli-bakim-tarihleri");

    if (inBas && sDurum.baslangic && !inBas.dataset.loaded) {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        inBas.value = new Date(sDurum.baslangic * 1000 - tzoffset).toISOString().slice(0, 16);
        inBas.dataset.loaded = "true";
    }
    if (inBit && sDurum.bitis && !inBit.dataset.loaded) {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        inBit.value = new Date(sDurum.bitis * 1000 - tzoffset).toISOString().slice(0, 16);
        inBit.dataset.loaded = "true";
    }

    if(btnM && yaziM) {
        if(sDurum.manuel_bakim) {
            btnM.innerText = "SİSTEMİ AÇ";
            btnM.className = "px-8 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all hover:-translate-y-1";
            btnM.disabled = false;
            yaziM.innerText = "BAKIM AKTİF (KAPALI)";
            yaziM.className = "text-sm font-black uppercase tracking-widest text-rose-400";
            if(msjM && sDurum.mesaj) msjM.value = sDurum.mesaj;
        } else if (sDurum.zamanli_bakim) {
            btnM.innerText = "KİLİTLİ (ZAMANLI AKTİF)";
            btnM.className = "px-8 py-3 rounded-xl font-bold text-slate-500 bg-slate-800 cursor-not-allowed border border-slate-700 transition-all";
            btnM.disabled = true; 
            yaziM.innerText = "ZAMANLI MOD DEVREDE";
            yaziM.className = "text-sm font-black uppercase tracking-widest text-slate-500";
        } else {
            btnM.innerText = "BAKIMA AL";
            btnM.className = "px-8 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all hover:-translate-y-1";
            btnM.disabled = false;
            yaziM.innerText = "SİSTEM AKTİF";
            yaziM.className = "text-sm font-black uppercase tracking-widest text-emerald-400";
        }
    }

    if(btnZ) {
        if(sDurum.zamanli_bakim) {
            btnZ.innerText = "ZAMANLAYICI AKTİF (KAPAT)";
            btnZ.className = "px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)] transition-all hover:-translate-y-1";
            btnZ.disabled = false;
            if(msjZ && sDurum.mesaj) msjZ.value = sDurum.mesaj;
            
            if(aktifBakimBilgisi && zamanliBakimTarihleri) {
                aktifBakimBilgisi.classList.remove("hidden");
                zamanliBakimTarihleri.innerText = `${formatTarih(sDurum.baslangic)} - ${formatTarih(sDurum.bitis)}`;
            }
        } else if (sDurum.manuel_bakim) {
            btnZ.innerText = "KİLİTLİ (MANUEL AKTİF)";
            btnZ.className = "px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-600 bg-slate-800/50 cursor-not-allowed transition-all border border-slate-700/50";
            btnZ.disabled = true; 
            if(aktifBakimBilgisi) aktifBakimBilgisi.classList.add("hidden");
        } else {
            btnZ.innerText = "ZAMANLAYICI KAPALI (AÇ)";
            btnZ.className = "px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest text-white bg-slate-700 hover:bg-slate-600 transition-all hover:-translate-y-1 border border-slate-600";
            btnZ.disabled = false;
            if(aktifBakimBilgisi) aktifBakimBilgisi.classList.add("hidden");
        }
    }

    const isInputDisabled = sDurum.manuel_bakim;
    const inputClassDisabled = "w-full p-4 bg-slate-900/40 border border-slate-800 rounded-xl text-xs font-semibold outline-none text-slate-600 cursor-not-allowed transition-colors";
    const inputClassActive = "w-full p-4 bg-slate-900/80 border border-slate-700 rounded-xl text-xs font-semibold outline-none text-slate-300 focus:border-sky-500 cursor-pointer transition-colors";

    if(inBas) { inBas.disabled = isInputDisabled; inBas.className = isInputDisabled ? inputClassDisabled : inputClassActive; }
    if(inBit) { inBit.disabled = isInputDisabled; inBit.className = isInputDisabled ? inputClassDisabled : inputClassActive; }
    if(msjM) { msjM.disabled = isInputDisabled || sDurum.zamanli_bakim; }
    if(msjZ) { msjZ.disabled = isInputDisabled || sDurum.zamanli_bakim; }

    document.querySelectorAll(".global-bakim-uyarisi").forEach(el => {
        if (sDurum.manuel_bakim || sDurum.zamanli_bakim) {
            el.classList.remove("hidden");
            const metinAlani = el.querySelector(".global-bakim-metni");
            if(metinAlani) {
                if (sDurum.manuel_bakim) {
                    metinAlani.innerText = `SİSTEM KİLİTLİ: ${sDurum.mesaj || 'Fiziksel Kilit Kapalı'}`;
                } else {
                    metinAlani.innerText = `ZAMANLANMIŞ BAKIM: ${sDurum.mesaj} (${formatTarih(sDurum.baslangic)} - ${formatTarih(sDurum.bitis)})`;
                }
            }
        } else {
            el.classList.add("hidden");
        }
    });
}

function toggleManuelBakim() {
    if (sDurum.zamanli_bakim) return;

    if (!sDurum.manuel_bakim) {
        const msj = document.getElementById("manuel-bakim-mesaji").value;
        if (!msj || msj.trim() === "") {
            return alert("Sistem Uyarısı: Sistemi kapatmak için lütfen bir Bakım Mesajı giriniz!");
        }
        const formatliMesaj = msj.trim().toUpperCase().substring(0, 16);
        database.ref('sistem_durumu').update({ manuel_bakim: true, mesaj: formatliMesaj });
    } else {
        database.ref('sistem_durumu').update({ manuel_bakim: false });
    }
}

function toggleZamanliBakim() {
    if (sDurum.manuel_bakim) return; 

    if (!sDurum.zamanli_bakim) { 
        const bas = document.getElementById("bakim-baslangic").value;
        const bit = document.getElementById("bakim-bitis").value;
        const msj = document.getElementById("zamanli-bakim-mesaji").value;
        const suAnUnix = Math.floor(Date.now() / 1000);

        if (!bas || !bit) return alert("Sistem Uyarısı: Zamanlı bakımı aktif etmek için önce başlangıç ve bitiş tarihlerini belirlemelisiniz.");
        if (!msj || msj.trim() === "") return alert("Sistem Uyarısı: Zamanlanmış bakımı başlatmak için lütfen bir mesaj giriniz!");

        const basUnix = Math.floor(new Date(bas).getTime() / 1000);
        const bitUnix = Math.floor(new Date(bit).getTime() / 1000);

        if (basUnix < suAnUnix - 60) return alert("Sistem Uyarısı: Bakım başlangıcı olarak geçmiş bir tarihi seçemezsiniz. Tarihi düzeltin!");
        if (bitUnix <= basUnix) return alert("Sistem Uyarısı: Mantıksız zaman aralığı! Bitiş zamanı, başlangıç zamanından önce veya aynı olamaz. Lütfen tarihleri düzeltin.");

        const formatliMesaj = msj.trim().toUpperCase().substring(0, 16);

        database.ref('sistem_durumu').update({ 
            baslangic: basUnix, 
            bitis: bitUnix, 
            zamanli_bakim: true, 
            mesaj: formatliMesaj 
        }).then(() => alert("Başarılı: Zamanlanmış bakım aktif edildi."));
    } else {
        database.ref('sistem_durumu').update({ zamanli_bakim: false });
    }
}

function zamanliBakimOtomatikKaydet() {
    const bas = document.getElementById("bakim-baslangic").value;
    const bit = document.getElementById("bakim-bitis").value;
    const msj = document.getElementById("zamanli-bakim-mesaji").value;
    
    if(bas && bit && msj && msj.trim() !== "") {
        const suAnUnix = Math.floor(Date.now() / 1000);
        const basZaman = new Date(bas).getTime();
        const bitZaman = new Date(bit).getTime();

        if (Math.floor(basZaman / 1000) < suAnUnix - 60) {
            alert("Sistem Uyarısı: Bakım başlangıcı olarak geçmiş bir tarihi seçemezsiniz!");
            document.getElementById("bakim-baslangic").value = ""; 
            return; 
        }

        if (bitZaman <= basZaman) {
            alert("Sistem Uyarısı: Bitiş zamanı, başlangıç zamanından önce veya aynı olamaz!");
            document.getElementById("bakim-bitis").value = ""; 
            return; 
        }

        const formatliMesaj = msj.trim().toUpperCase().substring(0, 16);

        database.ref('sistem_durumu').update({
            baslangic: Math.floor(basZaman / 1000),
            bitis: Math.floor(bitZaman / 1000),
            mesaj: formatliMesaj
        }).then(() => {
            const uyari = document.getElementById("otomatik-kayit-uyari");
            if(uyari) {
                uyari.style.opacity = "1";
                setTimeout(() => { uyari.style.opacity = "0"; }, 2000);
            }
        });
    }
}

function formatTarih(unixSaniye) {
    if(!unixSaniye) return "Belirsiz";
    return new Date(unixSaniye * 1000).toLocaleString('tr-TR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
}

function formatMilisaniye(milisaniye) {
    if(!milisaniye) return "Belirsiz";
    return new Date(milisaniye).toLocaleString('tr-TR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
}

function authKontrol() {
    const rawEmail = document.getElementById("login-email").value;
    const rawPass = document.getElementById("login-pass").value;
    const email = rawEmail.trim();
    const pass = CryptoJS.SHA256(rawPass.trim()).toString(); 

    let bulKullanici = null;
    let fbKey = null;
    for (let key in dbKullanicilari) {
        if (dbKullanicilari[key].email === email) {
            bulKullanici = dbKullanicilari[key];
            fbKey = key;
            break;
        }
    }
    
    if (bulKullanici && bulKullanici.sifre === pass) {
        aktifKullanici = { ...bulKullanici, fbKey: fbKey };
        document.getElementById("login-view").classList.add("hidden");
        
        if (aktifKullanici.rol === "admin") {
            document.getElementById("admin-dashboard").classList.remove("hidden");
            document.getElementById("admin-name").innerText = tamIsim(aktifKullanici);
            personelleriListele();
            adminTalepleriGetir();
            adminAktifSifreleriGetir(); 
            loglariGetir();
            istatistikleriGuncelle();
            uiBakimGuncelle();
        } else {
            document.getElementById("user-dashboard").classList.remove("hidden");
            document.getElementById("user-name").innerText = tamIsim(aktifKullanici);
            document.getElementById("user-id-display").innerText = "ID: " + aktifKullanici.id;
            kullaniciTalepleriniGetir();
            kullaniciAktifSifreleriGetir(); 
            loglariGetir(); 
        }
    } else { 
        alert("Sistem Uyarısı: Tanımsız veya Hatalı Kimlik Bilgisi!"); 
    }
}

function cikisYap() { location.reload(); }

function personelEkle() {
    const ad = document.getElementById("new-user-name").value;
    const soyad = document.getElementById("new-user-surname").value;
    const id = document.getElementById("new-user-id").value;
    const email = document.getElementById("new-user-email").value;
    const rawSifre = document.getElementById("new-user-pass").value;

    if(!ad || !soyad || !id || !email || !rawSifre) return alert("Eksik veri girişi yapıldı. Lütfen ad ve soyad dahil tüm alanları doldurun.");
    if(id.length !== 6) return alert("Sistem Uyarısı: Sicil No (ID) tam olarak 6 rakamdan oluşmalıdır!");
    
    const idKullaniliyorMu = Object.values(dbKullanicilari).some(u => u.id === id);
    if(idKullaniliyorMu) return alert("Çakışma Hatası: Bu Sicil No (ID) zaten başka bir personele atanmış. Lütfen farklı bir numara girin.");
    
    const sifre = CryptoJS.SHA256(rawSifre).toString();
    
    database.ref('kullanicilar').push().set({
        ad: ad, soyad: soyad, id: id, email: email, sifre: sifre, rol: "user"
    }).then(() => {
        alert("Başarılı: Personel Ağa Dahil Edildi.");
        modalKapat('add-user-modal');
        document.getElementById("new-user-name").value = "";
        document.getElementById("new-user-surname").value = "";
        document.getElementById("new-user-id").value = "";
        document.getElementById("new-user-email").value = "";
        document.getElementById("new-user-pass").value = "";
    });
}

function tumTalepleriSilKontrol() {
    database.ref('erisim_talepleri').once('value').then((snap) => {
        let silinebilirVarMi = false;
        if (snap.exists()) {
            const veriler = snap.val();
            Object.keys(veriler).forEach(id => {
                if (veriler[id].admin_degerlendirmesi.durum !== "beklemede" && !veriler[id].admin_gizledi) {
                    silinebilirVarMi = true;
                }
            });
        }
        
        if (silinebilirVarMi) {
            kayitSilModaliAc('tum_talepler');
        } else {
            alert("Sistem: Temizlenecek (cevaplanmış) herhangi bir erişim talebi bulunmuyor.");
        }
    });
}

function eskiSifreleriTemizleKontrol() {
    const suAn = Math.floor(Date.now() / 1000);
    database.ref('aktif_sifreler').once('value').then((snap) => {
        const veriler = snap.val();
        let silinecekSayisi = 0;
        
        if (veriler) {
            Object.keys(veriler).forEach(id => {
                if ((veriler[id].bitis < suAn || veriler[id].iptal_edildi) && !veriler[id].admin_gizledi) silinecekSayisi++;
            });
        }
        
        if (silinecekSayisi > 0) {
            kayitSilModaliAc('eski_sifreler', null, silinecekSayisi);
        } else {
            alert("Sistem: Ekrandan temizlenecek süresi dolmuş veya iptal edilmiş şifre bulunamadı.");
        }
    });
}

function kullaniciArayuzundenGizle(tip, key) {
    kayitSilModaliAc('user_' + tip, key);
}

function kayitSilModaliAc(tip, fbKey = null, ekstraVeri = null) {
    silinecekKayit = { tip: tip, key: fbKey, ekstra: ekstraVeri };
    
    const baslik = document.getElementById("delete-modal-title");
    const aciklama = document.getElementById("delete-modal-desc");
    
    if(tip === 'personel') {
        baslik.innerText = "Personeli Sistemden Sil";
        aciklama.innerText = "Bu personeli ve tüm erişim yetkilerini kalıcı olarak silmek istediğinize emin misiniz?";
    } else if (tip === 'talep') {
        baslik.innerText = "Erişim Talebini Temizle";
        aciklama.innerText = "Bu talebi yönetici panelinizden temizlemek istediğinize emin misiniz? (Kullanıcı kendi geçmişinde görmeye devam edecektir).";
    } else if (tip === 'talep_iptal') { 
        baslik.innerText = "Talebi ve Şifreyi İptal Et";
        aciklama.innerText = "Bu talebi iptal etmek ve eğer atanmış aktif bir şifre varsa onu da anında devre dışı bırakmak istediğinize emin misiniz? Bu işlem loglanacaktır.";
    } else if (tip === 'tum_talepler') {
        baslik.innerText = "Tüm Talepleri Temizle";
        aciklama.innerText = "Cevaplanmış bütün erişim taleplerini panelinizden temizlemek istediğinize emin misiniz? (Kullanıcılar kendi geçmişlerinde görmeye devam edecektir).";
    } else if (tip === 'eski_sifreler') {
        baslik.innerText = "Eski Şifreleri Süpür";
        aciklama.innerText = `Süresi dolmuş toplam ${ekstraVeri} adet şifreyi sistemden kalıcı olarak temizlemek istediğinize emin misiniz? (Aktif şifrelere dokunulmaz).`;
    } else if (tip === 'eski_sifre_tekil') {
        baslik.innerText = "Süresi Dolmuş Şifreyi Temizle";
        aciklama.innerText = "Bu eski şifreyi yönetici panelinden temizlemek istediğinize emin misiniz? (Kullanıcı kendi panelinde görmeye devam edecektir).";
    } else if (tip === 'aktif_sifre_iptal') {
        baslik.innerText = "Erişim Şifresini İptal Et";
        aciklama.innerText = "Bu personelin kripto giriş şifresini anında iptal etmek istediğinize emin misiniz? Şifre devre dışı bırakılacak ve güvenlik loglarına işlenecektir.";
    } else if (tip.startsWith('user_')) {
        baslik.innerText = "Kaydı Gizle";
        aciklama.innerText = "Bu kaydı kendi ekranınızdan kaldırmak istediğinize emin misiniz? (Sistem güvenlik kayıtlarında kalmaya devam edecektir).";
    }
    
    document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

function kaydiSilOnayla() {
    if (silinecekKayit.tip && silinecekKayit.tip.startsWith('user_')) {
        let path = "";
        if (silinecekKayit.tip === 'user_talep') path = 'erisim_talepleri/';
        else if (silinecekKayit.tip === 'user_log') path = 'sistem_loglari/';
        else if (silinecekKayit.tip === 'user_sifre') path = 'aktif_sifreler/';

        database.ref(path + silinecekKayit.key + '/kullanici_gizledi').set(true).then(() => {
            modalKapat('delete-confirm-modal');
            alert("Başarılı: Kayıt kişisel ekranınızdan kaldırıldı.");
            silinecekKayit = { tip: null, key: null, ekstra: null };
        });
    } 
    else if(silinecekKayit.tip === 'tum_talepler') {
        database.ref('erisim_talepleri').once('value').then((snap) => {
            if (snap.exists()) {
                const veriler = snap.val();
                const updates = {};
                Object.keys(veriler).forEach(id => {
                    if (veriler[id].admin_degerlendirmesi.durum !== "beklemede" && !veriler[id].admin_gizledi) {
                        updates[id + '/admin_gizledi'] = true;
                    }
                });
                database.ref('erisim_talepleri').update(updates).then(() => {
                    modalKapat('delete-confirm-modal');
                    alert("Başarılı: Cevaplanmış tüm talepler ekranınızdan temizlendi.");
                    silinecekKayit = { tip: null, key: null, ekstra: null };
                });
            }
        });
    } else if (silinecekKayit.tip === 'eski_sifreler') {
        const suAn = Math.floor(Date.now() / 1000);
        database.ref('aktif_sifreler').once('value').then((snap) => {
            const veriler = snap.val();
            let silinen = 0;
            const updates = {};
            if (veriler) {
                Object.keys(veriler).forEach(id => {
                    if ((veriler[id].bitis < suAn || veriler[id].iptal_edildi) && !veriler[id].admin_gizledi) {
                        updates[id + '/admin_gizledi'] = true;
                        silinen++;
                    }
                });
                database.ref('aktif_sifreler').update(updates).then(() => {
                    modalKapat('delete-confirm-modal');
                    alert(`Başarılı: Sistem Temizliği ile ${silinen} adet süresi dolmuş/iptal edilmiş şifre ekranınızdan temizlendi.`);
                    silinecekKayit = { tip: null, key: null, ekstra: null };
                });
            }
        });
    } else if (silinecekKayit.tip === 'eski_sifre_tekil') {
        database.ref('aktif_sifreler/' + silinecekKayit.key).update({ admin_gizledi: true }).then(() => {
            modalKapat('delete-confirm-modal');
            alert("Başarılı: Eski şifre ekranınızdan temizlendi.");
            silinecekKayit = { tip: null, key: null, ekstra: null };
        });
    } else if (silinecekKayit.tip === 'aktif_sifre_iptal') {
        const sifreRef = database.ref('aktif_sifreler/' + silinecekKayit.key);
        sifreRef.once('value').then((snap) => {
            const sifreData = snap.val();
            if(sifreData) {
                database.ref('sistem_loglari').push().set({
                    tip: "Sifre Iptali",
                    denenen_pin: sifreData.kapi_pini,
                    kullanici_id: sifreData.atandigi_id,
                    durum: "Manuel Iptal",
                    zaman: Math.floor(Date.now() / 1000)
                });
                
                sifreRef.update({ 
                    iptal_edildi: true, 
                    bitis: Math.floor(Date.now() / 1000) 
                }).then(() => {
                    modalKapat('delete-confirm-modal');
                    alert("Başarılı: Şifre iptal edildi ve güvenlik loglarına işlendi.");
                    silinecekKayit = { tip: null, key: null, ekstra: null };
                });
            }
        });
    } else if (silinecekKayit.tip === 'talep_iptal') { 
        const talepRef = database.ref('erisim_talepleri/' + silinecekKayit.key);
        const pinToCancel = silinecekKayit.ekstra;

        if (pinToCancel && pinToCancel !== "undefined" && pinToCancel !== "") {
            database.ref('aktif_sifreler').once('value').then((snap) => {
                const aktifler = snap.val();
                if(aktifler) {
                    Object.keys(aktifler).forEach(aid => {
                        if(aktifler[aid].kapi_pini === pinToCancel && !aktifler[aid].iptal_edildi) {
                            database.ref('sistem_loglari').push().set({
                                tip: "Sifre Iptali",
                                denenen_pin: pinToCancel,
                                kullanici_id: aktifler[aid].atandigi_id,
                                durum: "Manuel Iptal",
                                zaman: Math.floor(Date.now() / 1000)
                            });
                            database.ref('aktif_sifreler/' + aid).update({ 
                                iptal_edildi: true, 
                                bitis: Math.floor(Date.now() / 1000) 
                            });
                        }
                    });
                }
            });
        }
        
        talepRef.child('admin_degerlendirmesi').update({
            durum: "reddedildi",
            cevap_metni: "Yönetici Tarafından İptal Edildi."
        }).then(() => {
            modalKapat('delete-confirm-modal');
            alert("Başarılı: Talep iptal edildi ve (varsa) bağlı yetkiler geri alındı.");
            silinecekKayit = { tip: null, key: null, ekstra: null };
        });
        
    } else if (silinecekKayit.tip === 'talep' && silinecekKayit.key) {
        database.ref('erisim_talepleri/' + silinecekKayit.key).update({ admin_gizledi: true }).then(() => {
            modalKapat('delete-confirm-modal');
            alert("Başarılı: Talep sistemden (kendi görünümünüzden) kaldırıldı.");
            silinecekKayit = { tip: null, key: null, ekstra: null };
        });
    } else if (silinecekKayit.tip === 'personel' && silinecekKayit.key) {
        database.ref('kullanicilar/' + silinecekKayit.key).remove().then(() => {
            modalKapat('delete-confirm-modal');
            alert("Başarılı: Personel sistemden kalıcı olarak silindi.");
            silinecekKayit = { tip: null, key: null, ekstra: null }; 
        });
    }
}

function personelleriListele() {
    const tbody = document.getElementById("admin-personel-body");
    if(!tbody) return;
    tbody.innerHTML = "";
    
    Object.keys(dbKullanicilari).forEach(k => {
        const u = dbKullanicilari[k];
        if(u.rol === "user") {
            const silButonu = `<button onclick="kayitSilModaliAc('personel', '${k}')" class="group flex items-center justify-center w-10 h-10 bg-slate-800/50 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/50 rounded-xl transition-all shadow-sm hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]" title="Personeli Sil">
                       <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                   </button>`; 

            tbody.innerHTML += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                    <td class="px-8 py-5 font-mono font-bold text-sky-400 text-lg">${u.id}</td>
                    <td class="px-8 py-5 font-bold text-white tracking-wide">${tamIsim(u)}</td>
                    <td class="px-8 py-5 text-slate-400 text-sm">${u.email}</td>
                    <td class="px-8 py-5 text-right flex items-center justify-end space-x-3">
                        ${silButonu}
                        <button onclick="direktSifreAtaModalAc('${u.id}', '${tamIsim(u)}')" class="bg-gradient-to-r from-sky-600/20 to-indigo-600/20 hover:from-sky-500 hover:to-indigo-500 text-sky-400 hover:text-white border border-sky-500/30 hover:border-transparent px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-[0_0_10px_rgba(56,189,248,0.05)] hover:shadow-[0_0_15px_rgba(56,189,248,0.4)] whitespace-nowrap">Şifre Ata</button>
                    </td>
                </tr>
            `;
        }
    });
}

function direktSifreAtaModalAc(personelId, personelAd) {
    seciliTalepId = "DIREKT_" + personelId; 
    document.getElementById("modal-title").innerText = personelAd + " / Manuel Atama";
    document.getElementById("cevap-notu-alani").style.display = "none"; 
    document.getElementById("btn-reddet").style.display = "none"; 
    document.getElementById("btn-onayla").innerText = "Şifreyi Kriptola & Ata";
    
    let genPin = "";
    const suAn = Math.floor(Date.now() / 1000);
    let isU = false;
    
    database.ref('aktif_sifreler').once('value').then(snap => {
       const asL = snap.val() || {};
       while(!isU){
           genPin = Math.floor(1000 + Math.random() * 9000).toString();
           let exists = Object.values(asL).some(s => s.kapi_pini === genPin && s.bitis > suAn && !s.iptal_edildi);
           if(!exists) isU = true;
       }
       document.getElementById("admin-manuel-pin").value = genPin;
    });

    document.getElementById("admin-zaman-baslangic").value = "";
    document.getElementById("admin-zaman-bitis").value = "";
    document.getElementById("reply-modal").classList.remove("hidden");
}

function modalKapat(modalId) { 
    document.getElementById(modalId).classList.add("hidden"); 
}

function uretBenzersizPinWeb(callback) {
    let pin = "";
    let isUnique = false;
    const suAn = Math.floor(Date.now() / 1000);
    
    database.ref('aktif_sifreler').once('value').then(snap => {
        const asL = snap.val() || {};
        while (!isUnique) {
          pin = Math.floor(1000 + Math.random() * 9000).toString();
          const exists = Object.values(asL).some(s => s.kapi_pini === pin && s.bitis > suAn && !s.iptal_edildi);
          if (!exists) isUnique = true;
        }
        callback(pin);
    });
}

function talebiCevapla(karar) {
    const isDirekt = seciliTalepId.startsWith("DIREKT_");
    const pin = document.getElementById("admin-manuel-pin").value;
    const bas = document.getElementById("admin-zaman-baslangic").value;
    const bit = document.getElementById("admin-zaman-bitis").value;
    const not = document.getElementById("admin-cevap-metni").value;
    
    if (karar === "onay") {
        if (!pin || !bas || !bit) return alert("Eksik güvenlik parametresi!");
        
        const suAnUnix = Math.floor(Date.now() / 1000);
        const basUnix = Math.floor(new Date(bas).getTime() / 1000);
        const bitUnix = Math.floor(new Date(bit).getTime() / 1000);

        if (basUnix < suAnUnix - 60) {
            return alert("Sistem Uyarısı: Aktifleşme zamanı geçmiş olamaz!");
        }

        if (bitUnix <= basUnix) {
            return alert("Sistem Uyarısı: Bitiş zamanı başlangıçtan önce veya aynı olamaz! Lütfen tarihleri kontrol edin.");
        }

        database.ref('aktif_sifreler').once('value').then((snap) => {
            let pinExists = false;
            const aktifler = snap.val() || {};
            
            Object.values(aktifler).forEach(s => {
                if (s.kapi_pini === pin && s.bitis > suAnUnix && !s.iptal_edildi) {
                    pinExists = true;
                }
            });

            if (pinExists) {
                return alert("Çakışma Hatası: Bu PIN kodu şu anda başka bir aktif erişim için kullanılıyor. Lütfen benzersiz bir PIN belirleyin.");
            }

            if (isDirekt) {
                const pId = seciliTalepId.split("_")[1];
                database.ref('aktif_sifreler').push().set({ 
                    kapi_pini: pin, atandigi_id: pId,
                    baslangic: basUnix,
                    bitis: bitUnix
                }).then(() => {
                    modalKapat('reply-modal');
                    alert("Başarılı: Personele Kripto Şifre Atandı.");
                });
                return;
            }

            database.ref('erisim_talepleri/' + seciliTalepId).once('value').then((snapT) => {
                const t = snapT.val();
                database.ref('aktif_sifreler').push().set({ 
                    kapi_pini: pin, atandigi_id: t.kullanici_id,
                    baslangic: basUnix,
                    bitis: bitUnix
                });
                database.ref('erisim_talepleri/' + seciliTalepId + '/admin_degerlendirmesi').update({
                    durum: "onaylandi", admin_id: tamIsim(aktifKullanici),
                    cevap_metni: not || "Onaylandı",
                    uretilen_pin: pin 
                }).then(() => {
                    modalKapat('reply-modal');
                    alert("Başarılı: Talep onaylandı ve şifre atandı.");
                });
            });
        });

    } else {
        if (!isDirekt) {
            database.ref('erisim_talepleri/' + seciliTalepId + '/admin_degerlendirmesi').update({ durum: "reddedildi", cevap_metni: not || "Reddedildi" }).then(() => modalKapat('reply-modal'));
        }
    }
}

function cevapModalAc(talepId) {
    seciliTalepId = talepId;
    document.getElementById("modal-title").innerText = "Erişim Talebi Analizi";
    document.getElementById("cevap-notu-alani").style.display = "block"; 
    document.getElementById("btn-reddet").style.display = "inline-block";
    document.getElementById("btn-onayla").innerText = "Yetki Ver & Ata";
    
    document.getElementById("admin-cevap-metni").value = "";
    document.getElementById("admin-manuel-pin").value = "YÜKLENİYOR"; 
    
    uretBenzersizPinWeb((pin) => {
        document.getElementById("admin-manuel-pin").value = pin;
    });

    document.getElementById("admin-zaman-baslangic").value = "";
    document.getElementById("admin-zaman-bitis").value = "";
    
    document.getElementById("reply-modal").classList.remove("hidden");

    database.ref('erisim_talepleri/' + talepId).once('value').then((snap) => {
        const t = snap.val();
        if(t && t.kullanici_mesaji) {
            if(t.kullanici_mesaji.istenen_baslangic) {
                document.getElementById("admin-zaman-baslangic").value = stringToInputFormat(t.kullanici_mesaji.istenen_baslangic);
            }
            if(t.kullanici_mesaji.istenen_bitis) {
                document.getElementById("admin-zaman-bitis").value = stringToInputFormat(t.kullanici_mesaji.istenen_bitis);
            }
        }
    });
}

function istatistikleriGuncelle() {
    database.ref('aktif_sifreler').on('value', (snap) => {
        let aktifSayisi = 0;
        const suAn = Math.floor(Date.now() / 1000);
        if (snap.val()) {
            Object.values(snap.val()).forEach(s => {
                if (s && s.baslangic && s.bitis && suAn >= s.baslangic && suAn <= s.bitis && !s.iptal_edildi) aktifSayisi++;
            });
        }
        document.getElementById("stat-aktif").innerText = aktifSayisi;
    });

    database.ref('sistem_loglari').on('value', (snap) => {
        let bugunBasarili = 0;
        let bugunHatali = 0; 
        const bugunBaslangic = new Date().setHours(0,0,0,0) / 1000;
        
        if (snap.val()) {
            Object.values(snap.val()).forEach(log => {
                if(typeof log === 'object' && log.zaman >= bugunBaslangic) {
                    if (log.tip === "Basarili Giris" || (log.durum === "Basarili" && log.tip !== "Iceriden Cikis")) {
                        bugunBasarili++;
                    } 
                    else if (log.durum !== "Basarili" && log.tip !== "Iceriden Cikis" && log.tip !== "Sifre Iptali") {
                        bugunHatali++;
                    }
                }
            });
        }
        document.getElementById("stat-bugun").innerText = bugunBasarili;
        document.getElementById("stat-hata").innerText = bugunHatali;
    });
}

function kullaniciTalepGonder() {
    const mesaj = document.getElementById("user-talep-mesaji").value;
    const baslangic = document.getElementById("user-talep-baslangic").value;
    const bitis = document.getElementById("user-talep-bitis").value;

    if(!mesaj) return alert("Sistem: Gerekçe girmeden talep açılamaz.");
    if(!baslangic || !bitis) return alert("Sistem: Lütfen talep edilen tarih ve saatleri seçiniz.");

    const suAnUnix = Math.floor(Date.now() / 1000);
    const basUnix = Math.floor(new Date(baslangic).getTime() / 1000);
    const bitUnix = Math.floor(new Date(bitis).getTime() / 1000);

    if (bitUnix <= suAnUnix) {
        return alert("Sistem Uyarısı: Bitiş zamanı geçmişte olan bir talep oluşturamazsınız!");
    }

    if (bitUnix <= basUnix) {
        return alert("Sistem Uyarısı: Mantıksız zaman aralığı. Bitiş tarihi başlangıçtan önce veya aynı olamaz!");
    }

    database.ref('erisim_talepleri').push().set({
        kullanici_id: aktifKullanici.id,
        kullanici_adi: tamIsim(aktifKullanici),
        kullanici_mesaji: { 
            metin: mesaj, 
            istenen_baslangic: baslangic, 
            istenen_bitis: bitis,
            olusturulma_tarihi: Date.now() 
        },
        admin_degerlendirmesi: { durum: "beklemede", uretilen_pin: "" }
    }).then(() => { 
        alert("Başarılı: Şifreleme Talebi İletildi."); 
        document.getElementById("user-talep-mesaji").value = ""; 
        document.getElementById("user-talep-baslangic").value = "";
        document.getElementById("user-talep-bitis").value = "";
    });
}

function kullaniciTalepleriniGetir() {
    const tableBody = document.getElementById("user-ticket-body");
    database.ref('erisim_talepleri').on('value', (snapshot) => {
        tableBody.innerHTML = "";
        const veriler = snapshot.val();
        if (veriler) {
            Object.keys(veriler).reverse().forEach(id => {
                const talep = veriler[id];
                
                if(talep.kullanici_gizledi) return;

                if(talep.kullanici_id === aktifKullanici.id) {
                    const tarih = formatMilisaniye(talep.kullanici_mesaji.olusturulma_tarihi);
                    
                    const iBas = formatGuzelTarihDisplay(talep.kullanici_mesaji.istenen_baslangic);
                    const iBit = formatGuzelTarihDisplay(talep.kullanici_mesaji.istenen_bitis);

                    const talepTarihleriHTML = iBas ? `<div class="mt-2 text-[10px] text-emerald-500 font-bold uppercase tracking-wider bg-emerald-950/30 inline-block px-3 py-2 rounded-lg border border-emerald-500/20 shadow-inner">
                        <div class="mb-1 text-emerald-600/80">TALEP EDİLEN SÜRE:</div>
                        <div class="text-emerald-400">${iBas}</div>
                        <div class="h-px bg-emerald-500/20 my-1.5 w-full"></div>
                        <div class="text-emerald-400">${iBit}</div>
                    </div>` : "";

                    const durum = talep.admin_degerlendirmesi.durum;
                    let durumGosterimi = "";
                    if (durum === "beklemede") durumGosterimi = `<span class="inline-flex items-center text-amber-400 font-bold border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 rounded-xl text-xs shadow-[0_0_10px_rgba(245,158,11,0.2)]"><span class="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-pulse"></span>İnceleniyor</span>`;
                    else if (durum === "onaylandi") {
                        durumGosterimi = `<div class="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl shadow-[0_0_15px_rgba(16,185,129,0.15)]"><span class="text-emerald-400 font-bold text-xs block mb-1">Erişim Onaylandı</span><span class="text-3xl font-mono font-black text-white tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">${talep.admin_degerlendirmesi.uretilen_pin}</span></div>`;
                    } else durumGosterimi = `<span class="inline-flex items-center text-rose-400 font-bold border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 rounded-xl text-xs"><span class="w-2 h-2 rounded-full bg-rose-500 mr-2"></span>Reddedildi / İptal</span>`;
                    
                    const gizleButonu = `<button onclick="kullaniciArayuzundenGizle('talep', '${id}')" class="ml-3 group flex items-center justify-center w-8 h-8 bg-slate-800/50 hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 border border-slate-700/50 rounded-lg transition-all shadow-sm" title="Benden Gizle">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>`;
                    
                    const finalAksiyonHtml = `<div class="flex items-center justify-center">${durumGosterimi}${gizleButonu}</div>`;

                    tableBody.innerHTML += `<tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"><td class="px-8 py-5 text-xs font-semibold text-slate-400 align-top">${tarih}</td><td class="px-8 py-5 text-slate-200 w-1/2 align-top text-sm"><p class="mb-2">${talep.kullanici_mesaji.metin}</p>${talepTarihleriHTML}</td><td class="px-8 py-5 align-top text-center">${finalAksiyonHtml}</td></tr>`;
                }
            });
        }
    });
}

function adminTalepleriGetir() {
    const tableBody = document.getElementById("admin-ticket-body");
    database.ref('erisim_talepleri').on('value', (snapshot) => {
        tableBody.innerHTML = "";
        if (snapshot.val()) {
            Object.keys(snapshot.val()).reverse().forEach(id => {
                const talep = snapshot.val()[id];
                
                if (talep.admin_gizledi) return;

                const durum = talep.admin_degerlendirmesi.durum;
                const tarih = formatMilisaniye(talep.kullanici_mesaji.olusturulma_tarihi); 

                const iBas = formatGuzelTarihDisplay(talep.kullanici_mesaji.istenen_baslangic);
                const iBit = formatGuzelTarihDisplay(talep.kullanici_mesaji.istenen_bitis);
                const talepTarihleriHTML = iBas ? `<div class="mt-3 p-3 bg-slate-900/50 rounded-xl border border-sky-500/20 shadow-inner">
                    <p class="text-[9px] text-sky-500/70 font-black uppercase tracking-widest mb-2">Talep Edilen Süre</p>
                    <div class="text-xs text-slate-300 font-bold">${iBas}</div>
                    <div class="h-px bg-sky-500/10 my-2 w-full"></div>
                    <div class="text-xs text-slate-300 font-bold">${iBit}</div>
                </div>` : "";

                let islemBtn = "";
                let durumBadge = "";
                
                if (durum === "beklemede") {
                    durumBadge = `<span class="inline-flex items-center text-amber-400 font-bold border border-amber-500/50 bg-amber-500/10 px-3 py-1 rounded-xl text-[10px] uppercase tracking-wider"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse"></span>Bekliyor</span>`;
                    islemBtn = `<button onclick="cevapModalAc('${id}')" class="bg-sky-500/10 hover:bg-sky-500 hover:text-white border border-sky-500/50 text-sky-400 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_0_10px_rgba(56,189,248,0.1)]">Aksiyon Al</button>`;
                } else if (durum === "onaylandi") {
                    durumBadge = `<span class="inline-flex items-center text-emerald-400 font-bold border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 rounded-xl text-[10px] uppercase tracking-wider mb-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>Onaylandı</span>`;
                    islemBtn = `<span class="text-2xl text-white drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] font-mono font-black tracking-[0.2em] bg-slate-900/50 px-3 py-1 rounded-xl border border-slate-700">${talep.admin_degerlendirmesi.uretilen_pin}</span>`;
                } else {
                    durumBadge = `<span class="inline-flex items-center text-rose-400 font-bold border border-rose-500/50 bg-rose-500/10 px-3 py-1 rounded-xl text-[10px] uppercase tracking-wider mb-2"><span class="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>İptal / Red</span>`;
                    islemBtn = `<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 py-1 bg-slate-900/50 rounded-xl">İşlem Kapalı</span>`;
                }

                const suAn = Date.now();
                let isPast = false;
                const unixBitis = stringToUnix(talep.kullanici_mesaji.istenen_bitis);
                if (unixBitis) {
                    isPast = unixBitis * 1000 < suAn;
                }

                let silButonu = "";
                if (durum === "beklemede" || (durum === "onaylandi" && !isPast)) {
                    silButonu = `<button onclick="kayitSilModaliAc('talep_iptal', '${id}', '${talep.admin_degerlendirmesi.uretilen_pin}')" class="ml-3 group flex items-center justify-center w-8 h-8 bg-slate-800/50 hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 border border-slate-700/50 hover:border-amber-500/50 rounded-lg transition-all shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]" title="Talebi/Şifreyi İptal Et">
                        <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                    </button>`;
                } else {
                    silButonu = `<button onclick="kayitSilModaliAc('talep_gizle', '${id}')" class="ml-3 group flex items-center justify-center w-8 h-8 bg-slate-800/50 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/50 rounded-lg transition-all shadow-sm hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]" title="Ekrandan Temizle">
                        <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>`;
                }

                const finalAksiyonHtml = `<div class="flex items-center justify-end">${islemBtn}${silButonu}</div>`;

                tableBody.innerHTML += `<tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                    <td class="px-8 py-5 align-top"><div class="font-mono font-black text-sky-400 text-lg">${talep.kullanici_id}</div><div class="text-xs font-semibold text-slate-300 mt-1">${talep.kullanici_adi}</div></td>
                    <td class="px-8 py-5 text-slate-300 w-1/3 align-top"><div class="text-[10px] font-bold text-sky-500/60 mb-2 uppercase tracking-widest">${tarih}</div><p class="text-sm leading-relaxed">${talep.kullanici_mesaji.metin}</p>${talepTarihleriHTML}</td>
                    <td class="px-8 py-5 w-1/4 align-top text-center">${durumBadge}</td>
                    <td class="px-8 py-5 text-right align-top">${finalAksiyonHtml}</td>
                </tr>`;
            });
        }
    });
}

function adminAktifSifreleriGetir() {
    const tableBody = document.getElementById("admin-aktif-sifreler-body");
    if(!tableBody) return;
    
    database.ref('aktif_sifreler').on('value', (snapshot) => {
        tableBody.innerHTML = "";
        const veriler = snapshot.val();
        if (veriler) {
            const suAn = Math.floor(Date.now() / 1000);

            Object.keys(veriler).reverse().forEach(id => {
                const sifre = veriler[id];
                
                if (sifre.admin_gizledi) return;

                let userObj = null;
                for (let k in dbKullanicilari) {
                    if (dbKullanicilari[k].id === sifre.atandigi_id) {
                        userObj = dbKullanicilari[k];
                        break;
                    }
                }
                const isim = tamIsim(userObj);
                
                let durumBadge = "";
                if (sifre.iptal_edildi) {
                    durumBadge = `<span class="inline-flex items-center text-rose-400 font-bold text-[10px] bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/30 uppercase tracking-widest"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> İptal Edildi</span>`;
                } else if (suAn < sifre.baslangic) {
                    durumBadge = `<span class="inline-flex items-center text-amber-400 font-bold text-[10px] bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30 uppercase tracking-widest"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Bekliyor</span>`;
                } else if (suAn > sifre.bitis) {
                    durumBadge = `<span class="inline-flex items-center text-rose-400 font-bold text-[10px] bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/30 uppercase tracking-widest"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Süresi Doldu</span>`;
                } else {
                    durumBadge = `<span class="inline-flex items-center text-emerald-400 font-bold text-[10px] bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 uppercase tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.2)]"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span> Yayında</span>`;
                }

                let silButonu = "";
                if (!sifre.iptal_edildi && suAn <= sifre.bitis) {
                    silButonu = `<button onclick="kayitSilModaliAc('aktif_sifre_iptal', '${id}')" class="ml-3 group flex items-center justify-center w-8 h-8 bg-slate-800/50 hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 border border-slate-700/50 hover:border-amber-500/50 rounded-lg transition-all shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]" title="Şifreyi Anında İptal Et">
                        <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                    </button>`;
                } else {
                    silButonu = `<button onclick="kayitSilModaliAc('eski_sifre_tekil', '${id}')" class="ml-3 group flex items-center justify-center w-8 h-8 bg-slate-800/50 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/50 rounded-lg transition-all shadow-sm hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]" title="Ekrandan Temizle">
                        <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>`;
                }

                const finalAksiyonHtml = `<div class="flex items-center justify-end">${durumBadge}${silButonu}</div>`;

                tableBody.innerHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                        <td class="px-8 py-5"><div class="font-mono font-black text-sky-400 text-lg">${sifre.atandigi_id}</div><div class="text-xs font-semibold text-slate-300 mt-1">${isim}</div></td>
                        <td class="px-8 py-5 text-center"><span class="text-2xl font-mono font-black text-white tracking-[0.2em] bg-slate-900/80 px-4 py-2 rounded-xl border border-sky-500/20 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]">${sifre.kapi_pini}</span></td>
                        <td class="px-8 py-5 text-xs text-slate-400 font-medium">${formatTarih(sifre.baslangic)}</td>
                        <td class="px-8 py-5 text-xs text-slate-400 font-medium">${formatTarih(sifre.bitis)}</td>
                        <td class="px-8 py-5 text-right">${finalAksiyonHtml}</td>
                    </tr>
                `;
            });
        } else {
            tableBody.innerHTML = "<tr><td colspan='5' class='p-12 text-center text-slate-500 font-semibold text-sm'>Sistem ağında aktif kripto şifre bulunmuyor.</td></tr>";
        }
    });
}

function kullaniciAktifSifreleriGetir() {
    const listContainer = document.getElementById("user-aktif-sifreler-list");
    if(!listContainer) return;

    database.ref('aktif_sifreler').on('value', (snapshot) => {
        listContainer.innerHTML = "";
        const veriler = snapshot.val();
        let bulundu = false;
        
        if (veriler) {
            const suAn = Math.floor(Date.now() / 1000);
            Object.keys(veriler).reverse().forEach(id => {
                const sifre = veriler[id];
                
                if (sifre.atandigi_id === aktifKullanici.id) {
                    if (sifre.kullanici_gizledi) return;
                    
                    bulundu = true;
                    let durumBadge = "";
                    let isAcctive = false;
                    let cardBorder = "border-slate-700/50";
                    let cardBg = "bg-slate-900/50";

                    if (sifre.iptal_edildi) {
                        durumBadge = `<span class="bg-rose-500/10 text-rose-400 font-bold text-[10px] uppercase tracking-widest border border-rose-500/30 px-3 py-1.5 rounded-xl flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Yönetici İptal Etti</span>`;
                    } else if (suAn < sifre.baslangic) {
                        durumBadge = `<span class="bg-amber-500/10 text-amber-400 font-bold text-[10px] uppercase tracking-widest border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Bekleniyor</span>`;
                    } else if (suAn > sifre.bitis) {
                        durumBadge = `<span class="bg-rose-500/10 text-rose-400 font-bold text-[10px] uppercase tracking-widest border border-rose-500/30 px-3 py-1.5 rounded-xl flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Süresi Doldu</span>`;
                    } else {
                        durumBadge = `<span class="bg-emerald-500/10 text-emerald-400 font-bold text-[10px] uppercase tracking-widest border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center shadow-[0_0_10px_rgba(16,185,129,0.2)]"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span> Kullanıma Açık</span>`;
                        isAcctive = true;
                        cardBorder = "border-emerald-500/40";
                        cardBg = "bg-emerald-950/10";
                    }

                    let gizleButonu = "";
                    if (sifre.iptal_edildi || suAn > sifre.bitis) {
                        gizleButonu = `<button onclick="kullaniciArayuzundenGizle('sifre', '${id}')" class="ml-4 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-slate-300 rounded-lg transition-colors border border-slate-700/50" title="Benden Gizle"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>`;
                    }

                    listContainer.innerHTML += `
                        <div class="user-code-card p-8 rounded-[2.5rem] border ${cardBorder} ${cardBg} shadow-2xl flex flex-col items-center justify-between transition-all duration-500 hover:-translate-y-2 ${isAcctive ? 'active-card' : 'opacity-70 grayscale-[20%]'}">
                            <div class="w-full flex justify-between items-center mb-8">
                                <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Oturum Şifresi</div>
                                <div class="flex items-center">
                                    ${durumBadge}
                                    ${gizleButonu}
                                </div>
                            </div>
                            <div class="text-7xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] font-mono tracking-widest bg-slate-950/80 w-full text-center py-8 rounded-[2rem] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] border border-slate-800 mb-8">
                                ${sifre.kapi_pini}
                            </div>
                            <div class="w-full space-y-4 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50">
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-slate-500 font-bold uppercase tracking-wider">Geçerlilik Başı:</span>
                                    <span class="font-bold text-emerald-100">${formatTarih(sifre.baslangic)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-slate-500 font-bold uppercase tracking-wider">İptal Tarihi:</span>
                                    <span class="font-bold text-rose-200">${formatTarih(sifre.bitis)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });
        }
        
        if (!bulundu) {
            listContainer.innerHTML = `
                <div class="col-span-full p-20 text-center text-slate-500 bg-slate-900/30 rounded-[3rem] border border-slate-800 border-dashed backdrop-blur-sm">
                    <svg class="w-20 h-20 mx-auto mb-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    <p class="font-black text-2xl text-slate-300 mb-2 tracking-tight">Erişim Anahtarı Bulunamadı</p>
                    <p class="text-sm font-medium">Laboratuvar alanına giriş yapabilmek için sol menüden yeni bir talep oluşturun.</p>
                </div>
            `;
        }
    });
}

function loglariGetir() {
    database.ref('sistem_loglari').on('value', (snapshot) => {
        globalLoglar = [];
        const veriler = snapshot.val();
        if (veriler) {
            Object.keys(veriler).reverse().forEach(id => {
                globalLoglar.push({ ...veriler[id], fbKey: id });
            });
        }
        if(aktifKullanici && aktifKullanici.rol === "admin") {
            loglariEkranaBas("admin", globalLoglar, document.getElementById("admin-log-ara").value);
        } else if (aktifKullanici && aktifKullanici.rol === "user") {
            loglariEkranaBas("user", globalLoglar, document.getElementById("user-log-ara").value);
        }
    });
}

function loglariFiltrele(rol) {
    let filtreMetni = "";
    if (rol === "admin") filtreMetni = document.getElementById("admin-log-ara").value;
    else if (rol === "user") filtreMetni = document.getElementById("user-log-ara").value;
    loglariEkranaBas(rol, globalLoglar, filtreMetni);
}

function loglariEkranaBas(rol, logDizisi, filtreMetni = "") {
    let hedefDiv = "";
    if (rol === "admin") hedefDiv = document.getElementById("log-list");
    else if (rol === "user") hedefDiv = document.getElementById("user-log-list");
    
    if(!hedefDiv) return;
    hedefDiv.innerHTML = "";
    filtreMetni = filtreMetni.toLowerCase();

    let gosterilenSayisi = 0;

    logDizisi.forEach(log => {
        if (!log || typeof log !== 'object' || !log.denenen_pin) return;

        if (rol === "user") {
            if (log.kullanici_id !== aktifKullanici.id) return;
            if (log.kullanici_gizledi) return;
        }

        let logKullaniciGosterim = "";
        
        if (rol === "admin") {
            if (log.kullanici_id === "Manuel Cikis") {
                logKullaniciGosterim = "Laboratuvar İçi Çıkış";
            } else if (log.kullanici_id && log.kullanici_id !== "Bilinmiyor") {
                let uObj = null;
                for (let k in dbKullanicilari) {
                    if (dbKullanicilari[k].id === log.kullanici_id) {
                        uObj = dbKullanicilari[k];
                        break;
                    }
                }
                if (uObj) logKullaniciGosterim = `${tamIsim(uObj)} (ID: ${log.kullanici_id})`;
                else logKullaniciGosterim = `Sicil No: ${log.kullanici_id}`;
            } else {
                logKullaniciGosterim = "Bilinmeyen Kullanıcı";
            }
        } else {
            if (log.kullanici_id === "Manuel Cikis" || log.tip === "Iceriden Cikis") {
                logKullaniciGosterim = "Laboratuvar İçi Çıkış";
            } else {
                logKullaniciGosterim = "Erişim İşlemi";
            }
        }

        const isExit = (log.tip === "Iceriden Cikis" || log.kullanici_id === "Manuel Cikis");
        const isSuccess = (log.durum === "Basarili" || log.tip === "Basarili Giris") && !isExit;
        const isCancel = (log.tip === "Sifre Iptali"); 
        const logZamani = log.zaman ? new Date(log.zaman * 1000).toLocaleTimeString('tr-TR') : "Zaman Damgası Yok";
        
        const sebepMetni = (!isSuccess && !isExit && log.durum && log.durum !== "Hatali") ? `Gerekçe: ${turkcelestir(log.durum)}` : "";

        const aramaAlani = (logKullaniciGosterim + " " + log.denenen_pin + " " + turkcelestir(log.tip) + " " + sebepMetni).toLowerCase();
        if (filtreMetni && !aramaAlani.includes(filtreMetni)) return;

        gosterilenSayisi++;

        let borderClass = "";
        let textClass = "";
        let badgeText = "";
        let iconHtml = "";

        if (isCancel) {
            borderClass = 'border-amber-500/50 bg-amber-950/20';
            textClass = 'text-amber-400';
            badgeText = 'ŞİFRE İPTAL EDİLDİ';
            iconHtml = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
        } else if (isExit) {
            borderClass = 'border-sky-500/50 bg-sky-950/20';
            textClass = 'text-sky-400';
            badgeText = 'ÇIKIŞ ONAYLANDI';
            iconHtml = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>`;
        } else if (isSuccess) {
            borderClass = 'border-emerald-500/50 bg-emerald-950/20';
            textClass = 'text-emerald-400';
            badgeText = 'GİRİŞ ONAYLANDI';
            iconHtml = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else {
            borderClass = 'border-rose-500/50 bg-rose-950/20';
            textClass = 'text-rose-400';
            badgeText = 'ERİŞİM REDDEDİLDİ';
            iconHtml = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
        }

        const sebepGorsel = sebepMetni ? `<p class="text-[10px] font-bold ${textClass} mt-2 uppercase tracking-widest"><span class="bg-black/30 border border-white/10 px-2 py-1 rounded">${sebepMetni}</span></p>` : "";
        
        let gizleButonuHtml = "";
        if (rol === "user") {
            gizleButonuHtml = `<button onclick="kullaniciArayuzundenGizle('log', '${log.fbKey}')" class="ml-4 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-slate-300 rounded-lg transition-colors border border-slate-700/50" title="Kayıttan Gizle"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>`;
        }

        hedefDiv.innerHTML += `
            <div class="p-6 mb-4 border-l-4 ${borderClass} rounded-2xl shadow-lg flex justify-between items-center glass-panel hover-glow cursor-default">
                <div class="flex items-center">
                    <div class="p-4 rounded-2xl bg-slate-900/80 ${textClass} mr-6 border border-slate-700 shadow-inner">
                        ${iconHtml}
                    </div>
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${textClass}">${turkcelestir(log.tip) || "Sistem Denemesi"}</p>
                        <div class="flex items-end mb-1">
                            <p class="text-3xl font-mono font-black text-white mr-4">${log.denenen_pin}</p>
                            <p class="text-xs text-slate-400 font-bold uppercase tracking-wider pb-1">/ ${logKullaniciGosterim}</p>
                        </div>
                        ${sebepGorsel}
                    </div>
                </div>
                <div class="text-right flex flex-col items-end">
                    <div class="flex items-center mb-2">
                        <p class="text-sm font-bold text-slate-300">${logZamani}</p>
                        ${gizleButonuHtml}
                    </div>
                    <p class="text-[10px] font-black uppercase tracking-[0.1em] ${textClass} bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-xl inline-block shadow-inner">${badgeText}</p>
                </div>
            </div>`;
    });

    if(gosterilenSayisi === 0) {
        hedefDiv.innerHTML = `<div class="p-12 text-center text-slate-500 bg-slate-900/30 rounded-[2rem] border border-slate-800 border-dashed backdrop-blur-sm"><p class="font-bold text-lg">Eşleşen sistem kaydı bulunamadı.</p></div>`;
    }
}

function showTab(tabId, element, rol) {
    document.querySelectorAll(`.${rol}-tab`).forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll(`.nav-item`).forEach(item => {
        item.classList.remove('bg-sky-600/20', 'bg-emerald-600/20', 'border-sky-500/30', 'border-emerald-500/30', 'text-white', 'shadow-[0_0_15px_rgba(56,189,248,0.1)]', 'shadow-[0_0_15px_rgba(16,185,129,0.1)]');
    });
    
    if(element) {
        if(rol === 'admin') {
            element.classList.add('bg-sky-600/20', 'border-sky-500/30', 'text-white', 'shadow-[0_0_15px_rgba(56,189,248,0.1)]');
        } else {
            element.classList.add('bg-emerald-600/20', 'border-emerald-500/30', 'text-white', 'shadow-[0_0_15px_rgba(16,185,129,0.1)]');
        }
    }
}
