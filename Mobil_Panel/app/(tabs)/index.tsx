import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, SafeAreaView, StatusBar, ScrollView, LogBox, Modal, FlatList } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import CryptoJS from 'crypto-js';

// YENİ EKLENEN KÜTÜPHANELER
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Uyarıları gizle
LogBox.ignoreAllLogs();

import firebase from 'firebase/compat/app';
import 'firebase/compat/database';

// Bildirimlerin ön plandayken de görünmesini sağlayan ayar
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

// ==========================================
// 1. FIREBASE BAĞLANTISI
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAFRUFeg4cwR-ePqCDviSyNLavzyei28t0",
  authDomain: "zamanlamali-kilit.firebaseapp.com",
  databaseURL: "https://zamanlamali-kilit-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "zamanlamali-kilit",
  storageBucket: "zamanlamali-kilit.firebasestorage.app"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [aktifKullanici, setAktifKullanici] = useState<any>(null);
  const [aktifTab, setAktifTab] = useState('');

  // Veritabanı State'leri
  const [dbKullanicilar, setDbKullanicilar] = useState<any>({});
  const [sDurum, setSDurum] = useState<any>({ manuel_bakim: false, zamanli_bakim: false, baslangic: 0, bitis: 0, mesaj: "SISTEM BAKIMDA" });
  const [taleplerListesi, setTaleplerListesi] = useState<any[]>([]);
  const [aktifSifrelerListesi, setAktifSifrelerListesi] = useState<any[]>([]);
  const [loglar, setLoglar] = useState<any[]>([]);
  const [istatistik, setIstatistik] = useState({ aktif: 0, basarili: 0, hatali: 0 });

  // Arama ve Form State'leri
  const [logArama, setLogArama] = useState('');
  const [talepMesaji, setTalepMesaji] = useState('');
  
  // TARİH SEÇİCİ STATE'LERİ
  const [talepBaslangic, setTalepBaslangic] = useState<number | null>(null);
  const [talepBitis, setTalepBitis] = useState<number | null>(null);
  const [bakimBaslangic, setBakimBaslangic] = useState<number | null>(null);
  const [bakimBitis, setBakimBitis] = useState<number | null>(null);
  const [cevapBaslangic, setCevapBaslangic] = useState<number | null>(null);
  const [cevapBitis, setCevapBitis] = useState<number | null>(null);

  const [picker, setPicker] = useState({ show: false, mode: 'date', target: '' } as any);
  const [tempDate, setTempDate] = useState(new Date());

  const [replyModalGoster, setReplyModalGoster] = useState(false);
  const [addUserModalGoster, setAddUserModalGoster] = useState(false);
  const [seciliTalep, setSeciliTalep] = useState<any>(null);
  const [cevapPin, setCevapPin] = useState('');
  const [cevapNotu, setCevapNotu] = useState('');

  const [yeniPersonelAd, setYeniPersonelAd] = useState('');
  const [yeniPersonelSoyad, setYeniPersonelSoyad] = useState('');
  const [yeniPersonelId, setYeniPersonelId] = useState('');
  const [yeniPersonelEmail, setYeniPersonelEmail] = useState('');
  const [yeniPersonelSifre, setYeniPersonelSifre] = useState('');
  const [bakimMesaji, setBakimMesaji] = useState('SISTEM BAKIMDA');
  const [zamanliBakimMesaji, setZamanliBakimMesaji] = useState('RUTIN BAKIM');

  const tumPersoneller = Object.values(dbKullanicilar || {});
  
  const prevTalepler = useRef<any>({});
  const isInitialLoad = useRef(true);

  const tamIsim = (u: any) => {
    if (!u) return "Bilinmiyor";
    return ((u.ad || "") + (u.soyad ? " " + u.soyad : "")).trim();
  };

  // UYGULAMA AÇILDIĞINDA OTURUMU KONTROL ET
  useEffect(() => {
    const oturumuKontrolEt = async () => {
      try {
        const kayitliOturum = await AsyncStorage.getItem('@nexus_oturum');
        if (kayitliOturum !== null) {
          const kullanici = JSON.parse(kayitliOturum);
          setAktifKullanici(kullanici);
          setAktifTab(kullanici.rol === 'admin' ? 'admin_merkez' : 'user_talep');
        }
      } catch (e) {
        console.log("Oturum okuma hatası:", e);
      }
    };
    oturumuKontrolEt();
  }, []);

  // BİLDİRİME TIKLANINCA YÖNLENDİRME
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const action = response.notification.request.content.data?.action;
      if (action === 'goToTalepler') {
        setAktifTab('admin_talepler');
      } else if (action === 'goToGecmis') {
        setAktifTab('user_gecmis');
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const kRef = database.ref('kullanicilar');
    const cbK = kRef.on('value', snap => setDbKullanicilar(snap.val() || {}));
    
    const sdRef = database.ref('sistem_durumu');
    const cbSd = sdRef.on('value', snap => {
        const d = snap.val();
        if(d) {
            setSDurum(d);
            if (d.baslangic) setBakimBaslangic(d.baslangic);
            if (d.bitis) setBakimBitis(d.bitis);
            if (d.mesaj) {
              setBakimMesaji(d.mesaj);
              setZamanliBakimMesaji(d.mesaj);
            }
        }
    });
    
    const etRef = database.ref('erisim_talepleri');
    const cbEt = etRef.on('value', snap => {
      const data = snap.val();
      setTaleplerListesi(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse() : []);
    });

    const asRef = database.ref('aktif_sifreler');
    const cbAs = asRef.on('value', snap => {
      const data = snap.val();
      setAktifSifrelerListesi(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse() : []);
    });

    const slRef = database.ref('sistem_loglari');
    const cbSl = slRef.on('value', snap => {
      const data = snap.val();
      setLoglar(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse() : []);
    });

    return () => {
       kRef.off('value', cbK);
       sdRef.off('value', cbSd);
       etRef.off('value', cbEt);
       asRef.off('value', cbAs);
       slRef.off('value', cbSl);
    };
  }, []);

  // BİLDİRİM SİSTEMİ DİNLEYİCİLERİ
  useEffect(() => {
    if (!aktifKullanici) return;

    const izinIste = async () => {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('Bildirim izni alınamadı!');
        }
      }
    };
    izinIste();

    const notifTaleplerRef = database.ref('erisim_talepleri');
    let addedListener: any;
    let valueListener: any;

    if (aktifKullanici.rol === 'admin') {
      addedListener = notifTaleplerRef.on('child_added', (snapshot) => {
        if (isInitialLoad.current) return; 
        const talep = snapshot.val();
        Notifications.scheduleNotificationAsync({
          content: {
            title: "🔒 Yeni Erişim Talebi",
            body: `${talep.kullanici_adi} yeni bir giriş talebi oluşturdu.`,
            sound: true,
            data: { action: 'goToTalepler' },
          },
          trigger: null,
        });
      });
      notifTaleplerRef.once('value').then(() => { isInitialLoad.current = false; });
    } else {
      valueListener = notifTaleplerRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (isInitialLoad.current) {
          prevTalepler.current = data;
          isInitialLoad.current = false;
          return;
        }

        Object.keys(data).forEach(key => {
          const yeniTalep = data[key];
          const eskiTalep = prevTalepler.current[key];

          if (yeniTalep.kullanici_id === aktifKullanici.id) {
            if (eskiTalep && eskiTalep.admin_degerlendirmesi.durum === 'beklemede' && yeniTalep.admin_degerlendirmesi.durum !== 'beklemede') {
              const durum = yeniTalep.admin_degerlendirmesi.durum;
              const pin = yeniTalep.admin_degerlendirmesi.uretilen_pin;
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "🔒 Talep Sonuçlandı",
                  body: durum === 'onaylandi' ? `Talebiniz onaylandı! Şifreniz: ${pin}` : `Talebiniz reddedildi.`,
                  sound: true,
                  data: { action: 'goToGecmis' },
                },
                trigger: null,
              });
            }
          }
        });
        prevTalepler.current = data;
      });
    }

    return () => {
      if (addedListener) notifTaleplerRef.off('child_added', addedListener);
      if (valueListener) notifTaleplerRef.off('value', valueListener);
      isInitialLoad.current = true; 
    };
  }, [aktifKullanici]);

  useEffect(() => {
    const interval = setInterval(() => {
      const suAnUnix = Math.floor(Date.now() / 1000);
      if (sDurum.zamanli_bakim && sDurum.bitis > 0 && suAnUnix > sDurum.bitis) {
        database.ref('sistem_durumu').update({ zamanli_bakim: false });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [sDurum.zamanli_bakim, sDurum.bitis]);

  useEffect(() => {
    let aktif = 0, basarili = 0, hatali = 0;
    const suAn = Math.floor(Date.now() / 1000);
    const bugunBas = new Date().setHours(0,0,0,0) / 1000;

    aktifSifrelerListesi.forEach(s => {
      if (suAn >= s.baslangic && suAn <= s.bitis && !s.iptal_edildi) aktif++;
    });

    loglar.forEach(log => {
      if (log.zaman >= bugunBas) {
        if (log.tip === "Basarili Giris" || (log.durum === "Basarili" && log.tip !== "Iceriden Cikis")) {
            basarili++;
        }
        else if (log.durum !== "Basarili" && log.tip !== "Iceriden Cikis" && log.tip !== "Sifre Iptali") {
            hatali++;
        }
      }
    });
    setIstatistik({ aktif, basarili, hatali });
  }, [aktifSifrelerListesi, loglar]);

  const openPicker = (target: string) => {
    let initialDate = new Date();
    if (target === 'cevapBaslangic' && cevapBaslangic) initialDate = new Date(cevapBaslangic * 1000);
    else if (target === 'cevapBitis' && cevapBitis) initialDate = new Date(cevapBitis * 1000);
    else if (target === 'talepBaslangic' && talepBaslangic) initialDate = new Date(talepBaslangic * 1000);
    else if (target === 'talepBitis' && talepBitis) initialDate = new Date(talepBitis * 1000);
    else if (target === 'bakimBaslangic' && bakimBaslangic) initialDate = new Date(bakimBaslangic * 1000);
    else if (target === 'bakimBitis' && bakimBitis) initialDate = new Date(bakimBitis * 1000);

    setTempDate(initialDate);
    setPicker({ show: true, mode: 'date', target });
  };

  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
       setPicker({ ...picker, show: false });
       return;
    }
    const currentDate = selectedDate || tempDate;
    setTempDate(currentDate);

    if (picker.mode === 'date') {
       setPicker({ ...picker, mode: 'time' });
    } else {
       setPicker({ ...picker, show: false });
       const unix = Math.floor(currentDate.getTime() / 1000);
       
       if (picker.target === 'bakimBaslangic') setBakimBaslangic(unix);
       else if (picker.target === 'bakimBitis') setBakimBitis(unix);
       else if (picker.target === 'talepBaslangic') setTalepBaslangic(unix);
       else if (picker.target === 'talepBitis') setTalepBitis(unix);
       else if (picker.target === 'cevapBaslangic') setCevapBaslangic(unix);
       else if (picker.target === 'cevapBitis') setCevapBitis(unix);
    }
  };

  const gosterTarih = (unix: number | null) => {
    if (!unix) return "";
    const d = new Date(unix * 1000);
    const gun = String(d.getDate()).padStart(2, '0');
    const ay = String(d.getMonth() + 1).padStart(2, '0');
    const yil = d.getFullYear();
    const saat = String(d.getHours()).padStart(2, '0');
    const dk = String(d.getMinutes()).padStart(2, '0');
    return `${gun}/${ay}/${yil} ${saat}:${dk}`;
  };

  const formatGuzelTarihDisplay = (rawDate: string) => {
    if (!rawDate) return "";
    let dStr = rawDate.replace('T', ' ').replace(/\./g, ':');
    
    if (dStr.includes('-')) {
       const parts = dStr.split(' ');
       if(parts.length === 2){
          const dateP = parts[0].split('-');
          if(dateP.length === 3){
             return `${dateP[2]}/${dateP[1]}/${dateP[0]}   ⏳   ${parts[1]}`;
          }
       }
    }
    
    const mParts = dStr.split(' ');
    if (mParts.length === 2) {
       return `${mParts[0]}   ⏳   ${mParts[1]}`;
    }
    return dStr;
  }

  const stringToUnix = (dateString: string) => {
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

  const uretBenzersizPin = () => {
    let pin = "";
    let isUnique = false;
    const suAn = Math.floor(Date.now() / 1000);
    
    while (!isUnique) {
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      const exists = aktifSifrelerListesi.some((s:any) => s.kapi_pini === pin && s.bitis > suAn && !s.iptal_edildi);
      if (!exists) isUnique = true;
    }
    return pin;
  };

  const turkcelestir = (metin: string) => {
    if (!metin) return "";
    const sozluk: { [key: string]: string } = {
      "Iceriden Cikis": "İçeriden Çıkış",
      "Basarili Giris": "Başarılı Giriş",
      "Hatali Giris": "Hatalı Giriş",
      "Manuel Cikis": "Manuel Çıkış",
      "Basarili": "Başarılı",
      "Hatali": "Hatalı",
      "Suresi Dolmus": "Süresi Dolmuş",
      "Suresi Dolmus Giris": "Süresi Dolmuş Giriş",
      "Tanimsiz Sifre": "Tanımsız Şifre",
      "Zamanli Bakim Aktif": "Sistem Zamanlı Bakımda",
      "Manuel Bakim Aktif": "Sistem Bakımda",
      "Sifre Iptali": "Şifre İptali",
      "Manuel Iptal": "Yönetici Tarafından İptal Edildi"
    };
    return sozluk[metin] || metin; 
  };

  const authKontrol = async () => {
    const temizEmail = email.trim(); 
    const temizSifre = password.trim();

    const gercekKullanici: any = tumPersoneller.find((u:any) => u.email === temizEmail);
    const hashedPass = CryptoJS.SHA256(temizSifre).toString();

    if (gercekKullanici && gercekKullanici.sifre === hashedPass) {
      setAktifKullanici(gercekKullanici);
      setAktifTab(gercekKullanici.rol === 'admin' ? 'admin_merkez' : 'user_talep');
      
      try {
        await AsyncStorage.setItem('@nexus_oturum', JSON.stringify(gercekKullanici));
      } catch (e) {
        console.log("Kayıt hatası", e);
      }
    } else {
      Alert.alert("Erişim Reddedildi", "Tanımsız veya Hatalı Kimlik Bilgisi!");
    }
  };

  const cikisYap = async () => {
    try {
      await AsyncStorage.removeItem('@nexus_oturum');
      setAktifKullanici(null);
      setEmail('');
      setPassword('');
    } catch (e) {
      console.log("Çıkış hatası", e);
    }
  };

  const personelEkle = () => {
    if(!yeniPersonelAd || !yeniPersonelSoyad || !yeniPersonelId || !yeniPersonelEmail || !yeniPersonelSifre) return Alert.alert("Hata", "Lütfen ad ve soyad dahil tüm alanları doldurun.");
    if(yeniPersonelId.length !== 6) return Alert.alert("Sistem Uyarısı", "Sicil No (ID) tam olarak 6 rakamdan oluşmalıdır!");

    const idKullaniliyorMu = tumPersoneller.some((u:any) => u.id === yeniPersonelId);
    if(idKullaniliyorMu) return Alert.alert("Çakışma Hatası", "Bu Sicil No (ID) zaten başka bir personele atanmış. Lütfen farklı bir numara girin.");

    const hashedSifre = CryptoJS.SHA256(yeniPersonelSifre).toString();

    database.ref('kullanicilar').push().set({
        ad: yeniPersonelAd, soyad: yeniPersonelSoyad, id: yeniPersonelId, email: yeniPersonelEmail, sifre: hashedSifre, rol: "user"
    }).then(() => {
        Alert.alert("Başarılı", "Personel Ağa Dahil Edildi.");
        setAddUserModalGoster(false);
        setYeniPersonelAd(''); setYeniPersonelSoyad(''); setYeniPersonelId(''); setYeniPersonelEmail(''); setYeniPersonelSifre('');
    });
  };

  const adminPersonelSil = (id: string) => {
    Alert.alert("Personeli Sil", "Bu personeli ve tüm erişim yetkilerini kalıcı olarak silmek istediğinize emin misiniz?", [
      { text: "İptal Et", style: "cancel" },
      { text: "Evet, Sil", style: "destructive", onPress: () => database.ref(`kullanicilar/${id}`).remove() }
    ]);
  };

  const kullaniciKayitGizle = (path: string, id: string) => {
    Alert.alert("Kaydı Gizle", "Bu kaydı kendi ekranınızdan kaldırmak istediğinize emin misiniz?", [
       { text: "İptal", style: "cancel" },
       { text: "Gizle", style: "destructive", onPress: () => database.ref(`${path}/${id}`).update({ kullanici_gizledi: true }) }
    ]);
  };

  const adminKayitGizle = (path: string, id: string) => {
    Alert.alert("Ekrandan Temizle", "Bu kaydı yönetici panelinden temizlemek istediğinize emin misiniz?", [
       { text: "İptal", style: "cancel" },
       { text: "Temizle", style: "destructive", onPress: () => database.ref(`${path}/${id}`).update({ admin_gizledi: true }) }
    ]);
  };

  const adminAktifSifreIptal = (item: any) => {
    Alert.alert("Şifreyi İptal Et", "Bu şifreyi anında devre dışı bırakmak istiyor musunuz? İşlem loglanacaktır.", [
       { text: "Vazgeç", style: "cancel" },
       { text: "İptal Et", style: "destructive", onPress: () => {
           database.ref('sistem_loglari').push().set({
               tip: "Sifre Iptali", denenen_pin: item.kapi_pini, kullanici_id: item.atandigi_id, durum: "Manuel Iptal", zaman: Math.floor(Date.now() / 1000)
           });
           database.ref(`aktif_sifreler/${item.id}`).update({ iptal_edildi: true, bitis: Math.floor(Date.now() / 1000) });
       }}
    ]);
  };

  const adminTalepIptal = (item: any) => {
      Alert.alert("Talebi İptal Et", "Bu talebi ve atanmışsa şifresini iptal etmek istiyor musunuz?", [
       { text: "Vazgeç", style: "cancel" },
       { text: "İptal Et", style: "destructive", onPress: () => {
           if (item.admin_degerlendirmesi.uretilen_pin) {
               const p = aktifSifrelerListesi.find(s => s.kapi_pini === item.admin_degerlendirmesi.uretilen_pin && !s.iptal_edildi);
               if(p) {
                   database.ref('sistem_loglari').push().set({
                       tip: "Sifre Iptali", denenen_pin: p.kapi_pini, kullanici_id: p.atandigi_id, durum: "Manuel Iptal", zaman: Math.floor(Date.now() / 1000)
                   });
                   database.ref(`aktif_sifreler/${p.id}`).update({ iptal_edildi: true, bitis: Math.floor(Date.now() / 1000) });
               }
           }
           database.ref(`erisim_talepleri/${item.id}/admin_degerlendirmesi`).update({ durum: "reddedildi", cevap_metni: "Yönetici Tarafından İptal Edildi." });
       }}
    ]);
  };

  const adminTumTalepleriSil = () => {
      Alert.alert("Talepleri Temizle", "Cevaplanmış tüm talepleri temizlemek istiyor musunuz?", [
       { text: "İptal", style: "cancel" },
       { text: "Temizle", style: "destructive", onPress: () => {
           taleplerListesi.forEach(t => {
               if (t.admin_degerlendirmesi.durum !== 'beklemede' && !t.admin_gizledi) {
                   database.ref(`erisim_talepleri/${t.id}`).update({ admin_gizledi: true });
               }
           });
       }}
    ]);
  };

  const eskiSifreleriTemizle = () => {
    Alert.alert(
      "Sistem Temizliği",
      "Süresi dolmuş veya iptal edilmiş tüm şifre kayıtları ekrandan temizlenecek. Emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Evet, Temizle", 
          style: "destructive",
          onPress: () => {
            const suAn = Math.floor(Date.now() / 1000);
            let silinen = 0;
            aktifSifrelerListesi.forEach(sifre => {
              if ((suAn > sifre.bitis || sifre.iptal_edildi) && !sifre.admin_gizledi) {
                database.ref(`aktif_sifreler/${sifre.id}`).update({ admin_gizledi: true }); 
                silinen++;
              }
            });
            Alert.alert("Bilgi", `${silinen} adet geçmiş şifre başarıyla temizlendi.`);
          }
        }
      ]
    );
  };

  const kullaniciTalepGonder = () => {
    const suAnUnix = Math.floor(Date.now() / 1000);
    
    if(!talepMesaji) return Alert.alert("Hata", "Gerekçe girmeden talep açılamaz.");
    if(!talepBaslangic || !talepBitis) return Alert.alert("Sistem Uyarısı", "Lütfen başlangıç ve bitiş zamanını seçin!");
    
    if (talepBaslangic < suAnUnix - 60) return Alert.alert("Sistem Uyarısı", "Başlangıç zamanı olarak geçmişi seçemezsiniz!");
    if (talepBitis <= talepBaslangic) return Alert.alert("Sistem Uyarısı", "Bitiş zamanı, başlangıç zamanından önce veya aynı olamaz!");

    database.ref('erisim_talepleri').push().set({
        kullanici_id: aktifKullanici.id, kullanici_adi: tamIsim(aktifKullanici),
        kullanici_mesaji: { 
            metin: talepMesaji, 
            istenen_baslangic: gosterTarih(talepBaslangic), 
            istenen_bitis: gosterTarih(talepBitis), 
            olusturulma_tarihi: Date.now() 
        },
        admin_degerlendirmesi: { durum: "beklemede", uretilen_pin: "" }
    }).then(() => {
        Alert.alert("Başarılı", "Talebiniz yöneticiye iletildi.");
        setTalepMesaji(''); setTalepBaslangic(null); setTalepBitis(null);
        setAktifTab('user_gecmis');
    });
  };

  const toggleManuelBakim = () => {
    if (sDurum.zamanli_bakim) return; 
    
    if (!sDurum.manuel_bakim) {
        if (!bakimMesaji || bakimMesaji.trim() === "") {
            return Alert.alert("Sistem Uyarısı", "Sistemi kapatmak için lütfen bir Bakım Mesajı giriniz!");
        }
    }

    let formatliMesaj = bakimMesaji.trim().toUpperCase().substring(0, 16);
    database.ref('sistem_durumu').update({ 
      manuel_bakim: !sDurum.manuel_bakim,
      mesaj: formatliMesaj
    });
  };

  const toggleZamanliBakim = () => {
    if (sDurum.manuel_bakim) return; 
    const suAnUnix = Math.floor(Date.now() / 1000);
    
    if (!sDurum.zamanli_bakim) {
      if (!bakimBaslangic || !bakimBitis) return Alert.alert("Sistem Uyarısı", "Lütfen bakım için başlangıç ve bitiş tarihi seçin.");
      if (bakimBaslangic < suAnUnix - 60) return Alert.alert("Sistem Uyarısı", "Bakım başlangıcı olarak geçmişi seçemezsiniz!");
      if (bakimBitis <= bakimBaslangic) return Alert.alert("Sistem Uyarısı", "Bitiş zamanı başlangıçtan önce veya aynı olamaz!");
      
      if (!zamanliBakimMesaji || zamanliBakimMesaji.trim() === "") {
          return Alert.alert("Sistem Uyarısı", "Zamanlanmış bakımı başlatmak için lütfen bir mesaj giriniz!");
      }

      let formatliMesaj = zamanliBakimMesaji.trim().toUpperCase().substring(0, 16);

      database.ref('sistem_durumu').update({
          baslangic: bakimBaslangic, bitis: bakimBitis, zamanli_bakim: true, mesaj: formatliMesaj
      }).then(() => Alert.alert("Başarılı", "Zamanlanmış bakım aktif edildi."));
    } else {
      database.ref('sistem_durumu').update({ zamanli_bakim: false });
    }
  };

  const direktSifreAtaAc = (personelItem: any) => {
    setSeciliTalep({ id: "DIREKT_" + personelItem.id, kullanici_id: personelItem.id });
    setCevapPin(uretBenzersizPin()); 
    setCevapNotu('Manuel Olarak Atandı');
    setCevapBaslangic(null);
    setCevapBitis(null);
    setReplyModalGoster(true);
  };

  const isDirekt = seciliTalep?.id?.startsWith("DIREKT_");

  const talepCevaplaAction = (karar: string) => {
    if(karar === 'onay') {
      const suAnUnix = Math.floor(Date.now() / 1000);

      if(!cevapPin) return Alert.alert("Hata", "Atanacak PIN girilmelidir.");
      if(!cevapBaslangic || !cevapBitis) return Alert.alert("Sistem Uyarısı", "Personele şifre atamak için Aktifleşme ve İptal zamanını seçmelisiniz.");
      
      if (cevapBaslangic < suAnUnix - 60) return Alert.alert("Sistem Uyarısı", "Aktifleşme zamanı geçmiş olamaz!");
      if (cevapBitis <= cevapBaslangic) return Alert.alert("Sistem Uyarısı", "İptal zamanı, aktifleşme zamanından önce olamaz.");

      const pinExists = aktifSifrelerListesi.some((s:any) => s.kapi_pini === cevapPin && s.bitis > suAnUnix && !s.iptal_edildi);
      
      if (pinExists) {
          return Alert.alert("Çakışma Hatası", "Bu PIN kodu şu anda başka bir aktif erişim için kullanılıyor. Lütfen benzersiz bir PIN belirleyin.");
      }

      database.ref('aktif_sifreler').push().set({ 
          kapi_pini: cevapPin, atandigi_id: seciliTalep.kullanici_id, baslangic: cevapBaslangic, bitis: cevapBitis
      });

      if (!isDirekt) {
        database.ref(`erisim_talepleri/${seciliTalep.id}/admin_degerlendirmesi`).update({
            durum: "onaylandi", admin_id: tamIsim(aktifKullanici), cevap_metni: cevapNotu || "Onaylandı", uretilen_pin: cevapPin 
        });
      } else {
        Alert.alert("Başarılı", "Personele Kripto Şifre Atandı.");
      }
    } else {
      if (!isDirekt) {
        database.ref(`erisim_talepleri/${seciliTalep.id}/admin_degerlendirmesi`).update({ durum: "reddedildi", cevap_metni: cevapNotu || "Reddedildi" });
      }
    }
    setReplyModalGoster(false);
  };

  const renderLogItem = ({ item }: any) => {
    if (aktifKullanici?.rol === 'user' && item.kullanici_gizledi) return null;

    if (logArama) {
      const text = `${item.denenen_pin} ${item.kullanici_id} ${item.tip}`.toLowerCase();
      if (!text.includes(logArama.toLowerCase())) return null;
    }
    const isExit = item.tip === "Iceriden Cikis" || item.kullanici_id === "Manuel Cikis";
    const isCancel = item.tip === "Sifre Iptali";
    const isSuccess = (item.durum === "Basarili" || item.tip === "Basarili Giris") && !isExit && !isCancel;
    
    let borderRenk = '#fb7185';
    if (isExit) borderRenk = '#38bdf8';
    else if (isSuccess) borderRenk = '#34d399';
    else if (isCancel) borderRenk = '#fbbf24';

    let logKullaniciGosterim = item.kullanici_id;
    if (item.kullanici_id === "Manuel Cikis") {
        logKullaniciGosterim = "Laboratuvar İçi Çıkış";
    } else if (item.kullanici_id && item.kullanici_id !== "Bilinmiyor") {
        const uObj = tumPersoneller.find((u:any) => u.id === item.kullanici_id);
        if (uObj) {
            logKullaniciGosterim = `${tamIsim(uObj)} (ID: ${item.kullanici_id})`;
        }
    }
    
    return (
      <View style={[styles.cardList, {borderLeftWidth: 4, borderLeftColor: borderRenk}]}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <View>
            <Text style={{color: borderRenk, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}}>{turkcelestir(item.tip) || "Sistem Denemesi"}</Text>
            <Text style={{color: 'white', fontSize: 24, fontWeight: '900', fontFamily: 'monospace'}}>{item.denenen_pin || "----"}</Text>
            <Text style={{color: '#94a3b8', fontSize: 12}}>{logKullaniciGosterim}</Text>
            {(!isSuccess && !isExit && item.durum && item.durum !== "Hatali") && (
               <Text style={{color: borderRenk, fontSize: 10, marginTop: 5}}>Gerekçe: {turkcelestir(item.durum)}</Text>
            )}
          </View>
          <View style={{alignItems: 'flex-end'}}>
            <Text style={{color: borderRenk, fontSize: 10, fontWeight: 'bold', marginTop: 5, marginBottom: 5}}>
                {isSuccess ? 'ONAYLANDI' : (isExit ? 'ÇIKIŞ' : (isCancel ? 'İPTAL EDİLDİ' : 'REDDEDİLDİ'))}
            </Text>
            <Text style={{color: '#94a3b8', fontSize: 11}}>{gosterTarih(item.zaman)}</Text>
            {aktifKullanici?.rol === 'user' && (
                <TouchableOpacity onPress={() => kullaniciKayitGizle('sistem_loglari', item.id)} style={{marginTop: 10, backgroundColor: 'rgba(51, 65, 85, 0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8}}>
                    <Text style={{color: '#94a3b8', fontSize: 10}}>GİZLE</Text>
                </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ==========================================
  // GİRİŞ EKRANI
  // ==========================================
  if (!aktifKullanici) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.glassPanel}>
          <Text style={styles.iconText}>🔒</Text>
          <Text style={styles.title}>NEXUS OS</Text>
          <Text style={styles.subtitle}>Biyometrik & Kriptografik Erişim</Text>
          <TextInput style={styles.input} placeholder="E-Posta Adresi" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Güvenlik Şifresi" placeholderTextColor="#64748b" secureTextEntry value={password} onChangeText={setPassword} />
          <TouchableOpacity style={styles.buttonSky} onPress={authKontrol}><Text style={styles.buttonText}>Giriş Yap ve Yetkilendir</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Admin Filtreleri
  const adminGecerliTalepler = taleplerListesi.filter(t => !t.admin_gizledi);
  const personelListesi = tumPersoneller.filter((u:any) => u.rol === 'user' && u.id);
  
  const adminAktifSifreler = aktifSifrelerListesi.filter(s => !s.admin_gizledi);
  const suAn = Math.floor(Date.now() / 1000);
  const adminYayindaOlanlar = adminAktifSifreler.filter(s => suAn <= s.bitis && !s.iptal_edildi);
  const adminGecmisSifreler = adminAktifSifreler.filter(s => suAn > s.bitis || s.iptal_edildi);

  // User Filtreleri
  const userGecmisTalepler = taleplerListesi.filter(t => t.kullanici_id === aktifKullanici.id && !t.kullanici_gizledi);
  const userGirisLoglari = loglar.filter(l => l.kullanici_id === aktifKullanici.id);
  const userAktifSifreler = aktifSifrelerListesi.filter(s => s.atandigi_id === aktifKullanici.id && !s.kullanici_gizledi);
  
  const userYayindaOlanlar = userAktifSifreler.filter(s => suAn <= s.bitis && !s.iptal_edildi);
  const userGecmisSifreler = userAktifSifreler.filter(s => suAn > s.bitis || s.iptal_edildi);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      
      {picker.show && (
        <DateTimePicker value={tempDate} mode={picker.mode} is24Hour={true} display="default" onChange={onPickerChange} minimumDate={new Date()} />
      )}

      {/* YENİ EKLENEN: GLOBAL BAKIM UYARISI BAFON (BANNER) */}
      {(sDurum.manuel_bakim || sDurum.zamanli_bakim) && (
        <View style={{backgroundColor: 'rgba(244, 63, 94, 0.15)', paddingVertical: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(244, 63, 94, 0.3)'}}>
            <Text style={{color: '#fb7185', fontSize: 12, fontWeight: 'bold', textAlign: 'center'}}>
              🚨 {sDurum.manuel_bakim ? `SİSTEM KİLİTLİ: ${sDurum.mesaj}` : `ZAMANLANMIŞ BAKIM: ${sDurum.mesaj} (${gosterTarih(sDurum.baslangic)} - ${gosterTarih(sDurum.bitis)})`}
            </Text>
        </View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, {color: aktifKullanici.rol === 'admin' ? '#38bdf8' : '#34d399'}]}>
            {aktifKullanici.rol === 'admin' ? 'NEXUS OS' : 'PERSONEL AĞI'}
          </Text>
          <Text style={styles.headerSubtitle}>{tamIsim(aktifKullanici)} {aktifKullanici.rol === 'user' && `(ID: ${aktifKullanici.id})`}</Text>
        </View>
        <TouchableOpacity onPress={cikisYap} style={styles.logoutBtn}><Text style={{color: '#fb7185', fontWeight: 'bold', fontSize: 12}}>Çıkış</Text></TouchableOpacity>
      </View>

      <View style={{flex: 1, width: '100%'}}>
        
        {/* ================= ADMIN SEKMELERİ ================= */}
        {aktifTab === 'admin_merkez' && (
          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Kontrol Merkezi</Text>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15}}>
              <View style={[styles.statCard, {borderColor: 'rgba(56, 189, 248, 0.3)'}]}>
                <Text style={[styles.statLabel, {color: '#38bdf8'}]}>AKTİF ŞİFRELER</Text>
                <Text style={styles.statValue}>{istatistik.aktif}</Text>
              </View>
              <View style={[styles.statCard, {borderColor: 'rgba(16, 185, 129, 0.3)'}]}>
                <Text style={[styles.statLabel, {color: '#34d399'}]}>BUGÜN BAŞARILI</Text>
                <Text style={styles.statValue}>{istatistik.basarili}</Text>
              </View>
            </View>
            <View style={[styles.statCard, {borderColor: 'rgba(244, 63, 94, 0.3)', width: '100%', marginBottom: 30}]}>
              <Text style={[styles.statLabel, {color: '#fb7185'}]}>BUGÜN İHLAL / HATA</Text>
              <Text style={styles.statValue}>{istatistik.hatali}</Text>
            </View>

            <Text style={styles.sectionTitle}>Sistem Bakım</Text>
            
            <View style={styles.cardList}>
              <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 5}}>Anında Bakım Modu</Text>
              <Text style={{color: '#94a3b8', fontSize: 12, marginBottom: 15}}>Tesis anında kilitlenir, tuş takımı devre dışı bırakılır.</Text>
              
              <Text style={[styles.label, {color: '#38bdf8'}]}>Ekranda Görünecek Mesaj (Zorunlu)</Text>
              <TextInput 
                style={[styles.input, {borderColor: sDurum.manuel_bakim ? '#334155' : 'rgba(51, 65, 85, 0.5)'}]} 
                placeholder="Örn: SISTEM BAKIMDA" 
                placeholderTextColor="#64748b" 
                value={bakimMesaji} 
                onChangeText={setBakimMesaji} 
                maxLength={16}
                editable={!sDurum.manuel_bakim && !sDurum.zamanli_bakim}
              />

              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <Text style={{color: sDurum.manuel_bakim ? '#fb7185' : (sDurum.zamanli_bakim ? '#64748b' : '#34d399'), fontWeight: 'bold'}}>
                  {sDurum.manuel_bakim ? 'SİSTEM KİLİTLİ (BAKIM)' : (sDurum.zamanli_bakim ? 'ZAMANLI MOD DEVREDE' : 'SİSTEM AKTİF')}
                </Text>
                <TouchableOpacity 
                  disabled={sDurum.zamanli_bakim}
                  style={{backgroundColor: sDurum.zamanli_bakim ? '#334155' : (sDurum.manuel_bakim ? '#059669' : '#e11d48'), padding: 10, borderRadius: 10}}
                  onPress={toggleManuelBakim}
                >
                  <Text style={styles.buttonText}>{sDurum.zamanli_bakim ? 'KİLİTLİ' : (sDurum.manuel_bakim ? 'SİSTEMİ AÇ' : 'BAKIMA AL')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardList}>
              <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 5}}>Zamanlanmış Bakım</Text>
              <Text style={{color: '#94a3b8', fontSize: 12, marginBottom: 15}}>Tarih aralığında sistem otomatik kilitlenir.</Text>
              
              <Text style={[styles.label, {color: '#38bdf8'}]}>Ekranda Görünecek Mesaj (Zorunlu)</Text>
              <TextInput 
                style={[styles.input, {borderColor: sDurum.zamanli_bakim ? '#334155' : 'rgba(51, 65, 85, 0.5)'}]} 
                placeholder="Örn: RUTIN BAKIM" 
                placeholderTextColor="#64748b" 
                value={zamanliBakimMesaji} 
                onChangeText={setZamanliBakimMesaji} 
                maxLength={16}
                editable={!sDurum.manuel_bakim && !sDurum.zamanli_bakim}
              />

              <Text style={[styles.label, {color: '#38bdf8'}]}>BAŞLANGIÇ ZAMANI</Text>
              <TouchableOpacity disabled={sDurum.zamanli_bakim || sDurum.manuel_bakim} style={styles.inputDate} onPress={() => openPicker('bakimBaslangic')}>
                 <Text style={{color: bakimBaslangic ? 'white' : '#64748b'}}>{gosterTarih(bakimBaslangic) || "Tarih Seçiniz..."}</Text>
              </TouchableOpacity>
              
              <Text style={[styles.label, {color: '#38bdf8', marginTop: 10}]}>BİTİŞ ZAMANI</Text>
              <TouchableOpacity disabled={sDurum.zamanli_bakim || sDurum.manuel_bakim} style={styles.inputDate} onPress={() => openPicker('bakimBitis')}>
                 <Text style={{color: bakimBitis ? 'white' : '#64748b'}}>{gosterTarih(bakimBitis) || "Tarih Seçiniz..."}</Text>
              </TouchableOpacity>
              
              {/* YENİ EKLENEN: AKTİF ZAMANLI BAKIM TARİH GÖSTERİMİ */}
              {sDurum.zamanli_bakim && sDurum.baslangic > 0 && sDurum.bitis > 0 && (
                <View style={{backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 15, borderRadius: 15, marginTop: 15, borderColor: 'rgba(245, 158, 11, 0.3)', borderWidth: 1}}>
                   <Text style={{color: '#f59e0b', fontSize: 10, fontWeight: '900', marginBottom: 5, letterSpacing: 1}}>ŞU ANKİ AKTİF PLANLAMA:</Text>
                   <Text style={{color: '#f8fafc', fontSize: 13, fontWeight: 'bold'}}>{gosterTarih(sDurum.baslangic)} - {gosterTarih(sDurum.bitis)}</Text>
                </View>
              )}

              <TouchableOpacity 
                disabled={sDurum.manuel_bakim}
                style={[styles.buttonSky, {marginTop: 15, backgroundColor: sDurum.manuel_bakim ? '#334155' : (sDurum.zamanli_bakim ? '#e11d48' : '#059669')}]} 
                onPress={toggleZamanliBakim}>
                <Text style={styles.buttonText}>{sDurum.manuel_bakim ? 'KİLİTLİ (MANUEL)' : (sDurum.zamanli_bakim ? 'ZAMANLAYICIYI KAPAT' : 'ZAMANLAYICIYI AÇ')}</Text>
              </TouchableOpacity>
            </View>

            <View style={{height: 50}}/>
          </ScrollView>
        )}

        {aktifTab === 'admin_talepler' && (
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 20}}>
                <Text style={[styles.sectionTitle, {margin: 0, marginHorizontal: 0}]}>Erişim Talepleri</Text>
                <TouchableOpacity style={{backgroundColor: 'rgba(225, 29, 72, 0.1)', borderColor: 'rgba(225, 29, 72, 0.5)', borderWidth: 1, padding: 10, borderRadius: 10}} onPress={adminTumTalepleriSil}>
                    <Text style={{color: '#fb7185', fontWeight: 'bold', fontSize: 10}}>TÜMÜNÜ SİL</Text>
                </TouchableOpacity>
            </View>
            <FlatList 
              data={adminGecerliTalepler} 
              keyExtractor={i => i.id} 
              ListEmptyComponent={<Text style={styles.emptyText}>Bekleyen veya cevaplanmış erişim talebi bulunmuyor.</Text>}
              renderItem={({item}) => {
                const unixBitis = stringToUnix(item.kullanici_mesaji.istenen_bitis);
                const isPast = unixBitis ? unixBitis < (Date.now() / 1000) : false;
                
                const durum = item.admin_degerlendirmesi.durum;
                const isBeklemede = durum === 'beklemede';
                const isOnaylandiVeGecerli = durum === 'onaylandi' && !isPast;
                const showIptal = isBeklemede || isOnaylandiVeGecerli;

                return (
                  <View style={[styles.cardList, {marginHorizontal: 20}]}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                        <View style={{flex: 1}}>
                            <Text style={{color: '#38bdf8', fontWeight: 'bold', fontSize: 16}}>{item.kullanici_adi}</Text>
                            <Text style={{color: '#94a3b8', marginTop: 5, fontStyle: 'italic'}}>"{item.kullanici_mesaji.metin}"</Text>
                        </View>
                        
                        <TouchableOpacity onPress={() => showIptal ? adminTalepIptal(item) : adminKayitGizle('erisim_talepleri', item.id)} style={{backgroundColor: 'rgba(51, 65, 85, 0.5)', padding: 10, borderRadius: 10, height: 35, justifyContent: 'center', marginLeft: 10}}>
                            <Text style={{color: '#94a3b8', fontSize: 10, fontWeight: 'bold'}}>{showIptal ? 'İPTAL ET' : 'GİZLE'}</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {(item.kullanici_mesaji.istenen_baslangic || item.kullanici_mesaji.istenen_bitis) && (
                      <View style={{backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: 12, borderRadius: 12, marginTop: 12}}>
                         <Text style={{color: '#38bdf8', fontSize: 10, fontWeight: '900', marginBottom: 6, letterSpacing: 1}}>TALEP EDİLEN SÜRE</Text>
                         <View style={{flexDirection: 'row', alignItems: 'center'}}>
                             <Text style={{color: '#cbd5e1', fontSize: 13, fontWeight: 'bold'}}>{formatGuzelTarihDisplay(item.kullanici_mesaji.istenen_baslangic)}</Text>
                         </View>
                         <View style={{height: 1, backgroundColor: 'rgba(56,189,248,0.2)', marginVertical: 6}} />
                         <View style={{flexDirection: 'row', alignItems: 'center'}}>
                             <Text style={{color: '#cbd5e1', fontSize: 13, fontWeight: 'bold'}}>{formatGuzelTarihDisplay(item.kullanici_mesaji.istenen_bitis)}</Text>
                         </View>
                      </View>
                    )}

                    {isBeklemede ? (
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 15}}>
                        <TouchableOpacity style={[styles.islemBtn, {backgroundColor: '#0284c7'}]}
                          onPress={() => { 
                            setSeciliTalep(item); 
                            setCevapPin(uretBenzersizPin()); 
                            setCevapBaslangic(stringToUnix(item.kullanici_mesaji.istenen_baslangic)); 
                            setCevapBitis(stringToUnix(item.kullanici_mesaji.istenen_bitis)); 
                            setReplyModalGoster(true); 
                          }}>
                          <Text style={styles.buttonText}>Aksiyon Al</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={{color: durum === 'onaylandi' ? '#34d399' : '#fb7185', fontWeight: 'bold', marginTop: 15}}>
                        {durum.toUpperCase()} {item.admin_degerlendirmesi.uretilen_pin ? `(PIN: ${item.admin_degerlendirmesi.uretilen_pin})` : ''}
                      </Text>
                    )}
                  </View>
                )
              }} 
            />
          </View>
        )}

        {aktifTab === 'admin_personel' && (
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 20}}>
              <Text style={styles.sectionTitle}>Personel Ağı</Text>
              <TouchableOpacity style={{backgroundColor: '#0284c7', padding: 10, borderRadius: 10}} onPress={() => setAddUserModalGoster(true)}>
                <Text style={styles.buttonText}>+ Ekle</Text>
              </TouchableOpacity>
            </View>
            <FlatList 
              data={personelListesi} 
              keyExtractor={(i:any) => i.id || Math.random().toString()} 
              ListEmptyComponent={<Text style={styles.emptyText}>Sistemde kayıtlı personel bulunmuyor.</Text>}
              renderItem={({item}:any) => (
              <View style={[styles.cardList, {marginHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]}>
                <View>
                  <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>{tamIsim(item)}</Text>
                  <Text style={{color: '#94a3b8', fontSize: 12, marginTop: 3}}>ID: {item.id} | {item.email}</Text>
                </View>
                <View style={{flexDirection: 'row'}}>
                    <TouchableOpacity style={{backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.5)', borderWidth: 1, padding: 8, borderRadius: 10}}
                      onPress={() => direktSifreAtaAc(item)}>
                      <Text style={{color: '#38bdf8', fontSize: 10, fontWeight: 'bold'}}>ŞİFRE ATA</Text>
                    </TouchableOpacity>
                    {item.fbKey && (
                        <TouchableOpacity style={{marginLeft: 10, backgroundColor: 'rgba(225, 29, 72, 0.1)', borderColor: 'rgba(225, 29, 72, 0.5)', borderWidth: 1, padding: 8, borderRadius: 10}}
                          onPress={() => adminPersonelSil(item.fbKey)}>
                          <Text style={{color: '#fb7185', fontSize: 10, fontWeight: 'bold'}}>SİL</Text>
                        </TouchableOpacity>
                    )}
                </View>
              </View>
            )} />
          </View>
        )}

        {aktifTab === 'admin_aktif' && (
          <ScrollView style={{flex: 1}} keyboardShouldPersistTaps="handled">
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 20}}>
              <Text style={styles.sectionTitle}>Şifre Yönetimi</Text>
              <TouchableOpacity style={{backgroundColor: 'rgba(225, 29, 72, 0.1)', borderColor: 'rgba(225, 29, 72, 0.5)', borderWidth: 1, padding: 10, borderRadius: 10}} onPress={eskiSifreleriTemizle}>
                <Text style={{color: '#fb7185', fontWeight: 'bold', fontSize: 10}}>SÜPÜR</Text>
              </TouchableOpacity>
            </View>

            {/* AKTİF OLANLAR BÖLÜMÜ */}
            <Text style={{color: '#34d399', fontSize: 12, fontWeight: 'bold', marginLeft: 20, marginBottom: 10, letterSpacing: 1}}>🟢 ŞU AN YAYINDA OLANLAR</Text>
            {adminYayindaOlanlar.map(item => {
               const pObj = tumPersoneller.find((u:any) => u.id === item.atandigi_id);
               const personelAd = pObj ? tamIsim(pObj) : "Bilinmeyen Personel";
               return (
                 <View key={item.id} style={[styles.cardList, {marginHorizontal: 20, borderLeftWidth: 4, borderLeftColor: '#34d399'}]}>
                   <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                       <Text style={{color: 'white', fontSize: 30, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 5}}>{item.kapi_pini}</Text>
                       <TouchableOpacity onPress={() => adminAktifSifreIptal(item)} style={{backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.5)', borderWidth: 1, padding: 8, borderRadius: 10, height: 35}}>
                           <Text style={{color: '#f59e0b', fontSize: 10, fontWeight: 'bold'}}>İPTAL ET</Text>
                       </TouchableOpacity>
                   </View>
                   <Text style={{color: '#94a3b8', fontSize: 12, marginTop: 5}}>Personel: <Text style={{color: 'white', fontWeight: 'bold'}}>{personelAd}</Text> (ID: {item.atandigi_id})</Text>
                   <Text style={{color: '#34d399', fontSize: 10, fontWeight: 'bold', marginTop: 5}}>Bitiş: {gosterTarih(item.bitis)}</Text>
                 </View>
               )
            })}
            {adminYayindaOlanlar.length === 0 && (
               <Text style={styles.emptyText}>Aktif şifre bulunmuyor.</Text>
            )}

            {/* SÜRESİ DOLANLAR (GEÇMİŞ) BÖLÜMÜ */}
            <Text style={{color: '#fb7185', fontSize: 12, fontWeight: 'bold', marginLeft: 20, marginTop: 20, marginBottom: 10, letterSpacing: 1}}>🔴 SÜRESİ DOLANLAR / İPTALLER</Text>
            {adminGecmisSifreler.map(item => {
               const pObj = tumPersoneller.find((u:any) => u.id === item.atandigi_id);
               const personelAd = pObj ? tamIsim(pObj) : "Bilinmeyen Personel";
               return (
                 <View key={item.id} style={[styles.cardList, {marginHorizontal: 20, borderLeftWidth: 4, borderLeftColor: item.iptal_edildi ? '#f59e0b' : '#fb7185', opacity: 0.6}]}>
                   <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                       <Text style={{color: 'white', fontSize: 30, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 5, textDecorationLine: 'line-through'}}>{item.kapi_pini}</Text>
                       <TouchableOpacity onPress={() => adminKayitGizle('aktif_sifreler', item.id)} style={{backgroundColor: 'rgba(51, 65, 85, 0.5)', padding: 8, borderRadius: 10, height: 35}}>
                           <Text style={{color: '#94a3b8', fontSize: 10, fontWeight: 'bold'}}>GİZLE</Text>
                       </TouchableOpacity>
                   </View>
                   <Text style={{color: '#94a3b8', fontSize: 12, marginTop: 5}}>Personel: <Text style={{color: 'white', fontWeight: 'bold'}}>{personelAd}</Text> (ID: {item.atandigi_id})</Text>
                   <Text style={{color: item.iptal_edildi ? '#f59e0b' : '#fb7185', fontSize: 10, fontWeight: 'bold', marginTop: 5}}>{item.iptal_edildi ? 'İptal Edildi: ' : 'Süresi Doldu: '} {gosterTarih(item.bitis)}</Text>
                 </View>
               )
            })}
            {adminGecmisSifreler.length === 0 && (
               <Text style={styles.emptyText}>Geçmiş şifre kaydı bulunmuyor.</Text>
            )}
            <View style={{height: 50}}/>
          </ScrollView>
        )}

        {aktifTab === 'admin_loglar' && (
          <View style={{flex: 1}}>
             <View style={{margin: 20}}>
               <Text style={[styles.sectionTitle, {marginHorizontal: 0, marginTop: 0}]}>Sistem Logları</Text>
               <TextInput style={[styles.input, {marginBottom: 0}]} placeholder="Loglarda arama yap (PIN, İsim, ID vs.)" placeholderTextColor="#64748b" value={logArama} onChangeText={setLogArama}/>
             </View>
             <FlatList 
               data={loglar} 
               keyExtractor={(_, index) => index.toString()} 
               ListEmptyComponent={<Text style={styles.emptyText}>Sistem kaydı bulunamadı.</Text>}
               renderItem={renderLogItem} 
               contentContainerStyle={{paddingHorizontal: 20}} 
             />
          </View>
        )}

        {/* ================= PERSONEL SEKMELERİ ================= */}
        {aktifTab === 'user_talep' && (
          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sectionTitle, {color: '#34d399', marginTop: 20, marginHorizontal: 20}]}>Erişim Talebi</Text>
            <View style={styles.cardList}>
              <Text style={[styles.label, {color: '#34d399'}]}>GİRİŞ NEDENİ / AÇIKLAMA</Text>
              <TextInput style={[styles.input, {height: 80, textAlignVertical: 'top'}]} placeholder="Örn: Cihaz bakımı..." placeholderTextColor="#64748b" multiline value={talepMesaji} onChangeText={setTalepMesaji} />
              
              <Text style={[styles.label, {color: '#34d399', marginTop: 10}]}>BAŞLANGIÇ ZAMANI</Text>
              <TouchableOpacity style={styles.inputDate} onPress={() => openPicker('talepBaslangic')}>
                 <Text style={{color: talepBaslangic ? 'white' : '#64748b'}}>{gosterTarih(talepBaslangic) || "Tarih Seçin (Zorunlu)"}</Text>
              </TouchableOpacity>
              
              <Text style={[styles.label, {color: '#34d399', marginTop: 10}]}>BİTİŞ ZAMANI</Text>
              <TouchableOpacity style={styles.inputDate} onPress={() => openPicker('talepBitis')}>
                 <Text style={{color: talepBitis ? 'white' : '#64748b'}}>{gosterTarih(talepBitis) || "Tarih Seçin (Zorunlu)"}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.buttonSky, {backgroundColor: '#059669', marginTop: 10}]} onPress={kullaniciTalepGonder}>
                <Text style={styles.buttonText}>Talebi Sisteme İlet</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {aktifTab === 'user_sifrelerim' && (
          <ScrollView style={{flex: 1}}>
            <Text style={[styles.sectionTitle, {margin: 20, color: '#34d399'}]}>Şifrelerim</Text>

            {/* AKTİF OLANLAR BÖLÜMÜ */}
            <Text style={{color: '#34d399', fontSize: 12, fontWeight: 'bold', marginLeft: 20, marginBottom: 10, letterSpacing: 1}}>🟢 ŞU AN YAYINDA OLANLAR</Text>
            {userYayindaOlanlar.map(item => (
               <View key={item.id} style={[styles.cardList, {marginHorizontal: 20, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#34d399'}]}>
                 <Text style={{color: '#34d399', fontSize: 12, fontWeight: 'bold', marginBottom: 15}}>ŞU AN GEÇERLİ</Text>
                 <Text style={{fontSize: 60, fontWeight: '900', color: 'white', letterSpacing: 8, fontFamily: 'monospace'}}>{item.kapi_pini}</Text>
                 <Text style={{color: '#94a3b8', fontSize: 12, marginTop: 15}}>Bitiş: {gosterTarih(item.bitis)}</Text>
               </View>
            ))}
            {userYayindaOlanlar.length === 0 && (
               <Text style={styles.emptyText}>Şu an geçerli bir şifreniz bulunmuyor.</Text>
            )}

            {/* SÜRESİ DOLANLAR (GEÇMİŞ) BÖLÜMÜ */}
            <Text style={{color: '#fb7185', fontSize: 12, fontWeight: 'bold', marginLeft: 20, marginTop: 20, marginBottom: 10, letterSpacing: 1}}>🔴 SÜRESİ DOLANLAR / İPTALLER</Text>
            {userGecmisSifreler.map(item => (
               <View key={item.id} style={[styles.cardList, {marginHorizontal: 20, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: item.iptal_edildi ? '#f59e0b' : '#fb7185', opacity: 0.6}]}>
                 <View style={{position: 'absolute', top: 15, right: 15}}>
                     <TouchableOpacity onPress={() => kullaniciKayitGizle('aktif_sifreler', item.id)} style={{backgroundColor: 'rgba(51, 65, 85, 0.5)', padding: 8, borderRadius: 10}}>
                         <Text style={{color: '#94a3b8', fontSize: 10, fontWeight: 'bold'}}>GİZLE</Text>
                     </TouchableOpacity>
                 </View>
                 <Text style={{color: item.iptal_edildi ? '#f59e0b' : '#fb7185', fontSize: 12, fontWeight: 'bold', marginBottom: 15}}>{item.iptal_edildi ? 'YÖNETİCİ İPTAL ETTİ' : 'SÜRESİ DOLDU'}</Text>
                 <Text style={{fontSize: 60, fontWeight: '900', color: 'white', letterSpacing: 8, fontFamily: 'monospace', textDecorationLine: 'line-through'}}>{item.kapi_pini}</Text>
                 <Text style={{color: item.iptal_edildi ? '#f59e0b' : '#fb7185', fontSize: 12, marginTop: 15}}>{item.iptal_edildi ? 'İptal Edildi: ' : 'Bitiş: '} {gosterTarih(item.bitis)}</Text>
               </View>
            ))}
            {userGecmisSifreler.length === 0 && (
               <Text style={styles.emptyText}>Geçmiş şifre kaydınız bulunmuyor.</Text>
            )}
            <View style={{height: 50}}/>
          </ScrollView>
        )}

        {aktifTab === 'user_gecmis' && (
          <View style={{flex: 1}}>
            <Text style={[styles.sectionTitle, {margin: 20, color: '#34d399'}]}>Talep Geçmişim</Text>
            <FlatList 
              data={userGecmisTalepler} 
              keyExtractor={i => i.id} 
              ListEmptyComponent={<Text style={styles.emptyText}>Geçmiş talebiniz bulunmuyor.</Text>}
              renderItem={({item}) => {
                const durum = item.admin_degerlendirmesi.durum;

                return (
                  <View style={[styles.cardList, {marginHorizontal: 20}]}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Text style={{color: '#94a3b8', fontSize: 12}}>{gosterTarih(Math.floor(item.kullanici_mesaji.olusturulma_tarihi / 1000))}</Text>
                        <TouchableOpacity onPress={() => kullaniciKayitGizle('erisim_talepleri', item.id)} style={{backgroundColor: 'rgba(51, 65, 85, 0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8}}>
                            <Text style={{color: '#94a3b8', fontSize: 10}}>GİZLE</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={{color: 'white', fontSize: 15, marginVertical: 10}}>"{item.kullanici_mesaji.metin}"</Text>
                    
                    {(item.kullanici_mesaji.istenen_baslangic || item.kullanici_mesaji.istenen_bitis) && (
                      <View style={{backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: 12, borderRadius: 12, marginTop: 5, marginBottom: 10}}>
                         <Text style={{color: '#34d399', fontSize: 10, fontWeight: 'bold', marginBottom: 6, letterSpacing: 1}}>TALEP EDİLEN SÜRE:</Text>
                         <Text style={{color: '#f8fafc', fontSize: 13, fontWeight: 'bold'}}>{formatGuzelTarihDisplay(item.kullanici_mesaji.istenen_baslangic)}</Text>
                         <View style={{height: 1, backgroundColor: 'rgba(52,211,153,0.2)', marginVertical: 6}} />
                         <Text style={{color: '#f8fafc', fontSize: 13, fontWeight: 'bold'}}>{formatGuzelTarihDisplay(item.kullanici_mesaji.istenen_bitis)}</Text>
                      </View>
                    )}

                    <Text style={{color: durum === 'onaylandi' ? '#34d399' : (durum === 'reddedildi' ? '#fb7185' : '#fbbf24'), fontWeight: 'bold'}}>
                      {durum.toUpperCase()} {item.admin_degerlendirmesi.uretilen_pin ? `(PIN: ${item.admin_degerlendirmesi.uretilen_pin})` : ''}
                    </Text>
                  </View>
                )
              }} 
            />
          </View>
        )}

        {aktifTab === 'user_loglar' && (
          <View style={{flex: 1}}>
             <View style={{margin: 20}}>
               <Text style={[styles.sectionTitle, {marginHorizontal: 0, marginTop: 0, color: '#34d399'}]}>Giriş Kayıtlarım</Text>
               <TextInput style={[styles.input, {marginBottom: 0}]} placeholder="Loglarda ara..." placeholderTextColor="#64748b" value={logArama} onChangeText={setLogArama}/>
             </View>
             <FlatList 
               data={userGirisLoglari} 
               keyExtractor={(_, idx) => idx.toString()} 
               ListEmptyComponent={<Text style={styles.emptyText}>Giriş kaydınız bulunmuyor.</Text>}
               renderItem={renderLogItem} 
               contentContainerStyle={{paddingHorizontal: 20}} 
             />
          </View>
        )}

      </View>

      {/* ================= ALT MENÜ ================= */}
      <View style={styles.bottomNav}>
        {aktifKullanici.rol === 'admin' ? (
          <>
            <TouchableOpacity onPress={() => setAktifTab('admin_merkez')} style={styles.navItem}><Text style={aktifTab === 'admin_merkez' ? styles.navActiveSky : styles.navText}>Sistem</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAktifTab('admin_talepler')} style={styles.navItem}><Text style={aktifTab === 'admin_talepler' ? styles.navActiveSky : styles.navText}>Talepler</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAktifTab('admin_personel')} style={styles.navItem}><Text style={aktifTab === 'admin_personel' ? styles.navActiveSky : styles.navText}>Personel</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAktifTab('admin_aktif')} style={styles.navItem}><Text style={aktifTab === 'admin_aktif' ? styles.navActiveSky : styles.navText}>Şifreler</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAktifTab('admin_loglar')} style={styles.navItem}><Text style={aktifTab === 'admin_loglar' ? styles.navActiveSky : styles.navText}>Loglar</Text></TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setAktifTab('user_talep')} style={styles.navItem}><Text style={aktifTab === 'user_talep' ? styles.navActiveEmerald : styles.navText}>Talep Aç</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAktifTab('user_sifrelerim')} style={styles.navItem}><Text style={aktifTab === 'user_sifrelerim' ? styles.navActiveEmerald : styles.navText}>Şifrelerim</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAktifTab('user_gecmis')} style={styles.navItem}><Text style={aktifTab === 'user_gecmis' ? styles.navActiveEmerald : styles.navText}>Geçmiş</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAktifTab('user_loglar')} style={styles.navItem}><Text style={aktifTab === 'user_loglar' ? styles.navActiveEmerald : styles.navText}>Girişlerim</Text></TouchableOpacity>
          </>
        )}
      </View>

      {/* ================= MODALLAR ================= */}
      <Modal visible={replyModalGoster} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={[styles.sectionTitle, {color: '#38bdf8', marginLeft: 0, marginTop: 0}]}>Şifre Ata & Yanıtla</Text>
              
              <Text style={styles.label}>ATANACAK PİN</Text>
              <TextInput style={[styles.input, {fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: 5}]} value={cevapPin} onChangeText={setCevapPin} />
              
              <Text style={styles.label}>AKTİFLEŞME ZAMANI</Text>
              <TouchableOpacity style={styles.inputDate} onPress={() => openPicker('cevapBaslangic')}>
                 <Text style={{color: cevapBaslangic ? 'white' : '#64748b'}}>{gosterTarih(cevapBaslangic) || "Tarih Seçin (Zorunlu)"}</Text>
              </TouchableOpacity>
              
              <Text style={styles.label}>İPTAL ZAMANI</Text>
              <TouchableOpacity style={styles.inputDate} onPress={() => openPicker('cevapBitis')}>
                 <Text style={{color: cevapBitis ? 'white' : '#64748b'}}>{gosterTarih(cevapBitis) || "Tarih Seçin (Zorunlu)"}</Text>
              </TouchableOpacity>
              
              {!isDirekt && (
                <>
                  <Text style={styles.label}>SİSTEM NOTU (OPSİYONEL)</Text>
                  <TextInput style={styles.input} placeholder="Örn: Onaylandı..." placeholderTextColor="#64748b" value={cevapNotu} onChangeText={setCevapNotu} />
                </>
              )}
              
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10}}>
                {!isDirekt && (
                  <TouchableOpacity style={[styles.buttonSky, {backgroundColor: '#e11d48', flex: 1, marginRight: 10}]} onPress={() => talepCevaplaAction('red')}><Text style={styles.buttonText}>Reddet</Text></TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.buttonSky, {flex: 1, marginLeft: isDirekt ? 0 : 10}]} onPress={() => talepCevaplaAction('onay')}><Text style={styles.buttonText}>Yetkilendir</Text></TouchableOpacity>
              </View>
              <TouchableOpacity style={{marginTop: 20, alignItems: 'center', padding: 10}} onPress={() => setReplyModalGoster(false)}><Text style={{color: '#94a3b8'}}>İptal Et</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={addUserModalGoster} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={[styles.sectionTitle, {color: '#38bdf8', marginLeft: 0, marginTop: 0}]}>Yeni Personel</Text>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="Ad" placeholderTextColor="#64748b" value={yeniPersonelAd} onChangeText={setYeniPersonelAd} />
                  <TextInput style={[styles.input, {flex: 1}]} placeholder="Soyad" placeholderTextColor="#64748b" value={yeniPersonelSoyad} onChangeText={setYeniPersonelSoyad} />
              </View>
              <TextInput style={styles.input} placeholder="Sicil No (ID)" placeholderTextColor="#64748b" value={yeniPersonelId} onChangeText={setYeniPersonelId} maxLength={6} keyboardType="numeric" />
              <TextInput style={styles.input} placeholder="E-Posta" placeholderTextColor="#64748b" value={yeniPersonelEmail} onChangeText={setYeniPersonelEmail} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Geçici Şifre" placeholderTextColor="#64748b" value={yeniPersonelSifre} onChangeText={setYeniPersonelSifre} />
              <TouchableOpacity style={styles.buttonSky} onPress={personelEkle}><Text style={styles.buttonText}>Sisteme Kaydet</Text></TouchableOpacity>
              <TouchableOpacity style={{marginTop: 20, alignItems: 'center', padding: 10}} onPress={() => setAddUserModalGoster(false)}><Text style={{color: '#94a3b8'}}>Kapat</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ==========================================
// TASARIM KODLARI (CSS -> StyleSheet)
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' },
  glassPanel: { width: '85%', backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 30, borderRadius: 35, borderColor: 'rgba(56, 189, 248, 0.2)', borderWidth: 1, alignItems: 'center' },
  iconText: { fontSize: 40, marginBottom: 15 },
  title: { fontSize: 36, fontWeight: '900', color: '#38bdf8', marginBottom: 5 },
  subtitle: { fontSize: 12, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 30 },
  input: { width: '100%', backgroundColor: 'rgba(2, 6, 23, 0.6)', borderColor: 'rgba(51, 65, 85, 0.5)', borderWidth: 1, borderRadius: 15, color: '#f8fafc', padding: 18, marginBottom: 15, fontSize: 14 },
  
  inputDate: { width: '100%', backgroundColor: 'rgba(2, 6, 23, 0.6)', borderColor: 'rgba(51, 65, 85, 0.5)', borderWidth: 1, borderRadius: 15, padding: 18, marginBottom: 15, justifyContent: 'center' },
  
  label: { width: '100%', color: '#38bdf8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginLeft: 5 },
  buttonSky: { width: '100%', backgroundColor: '#0284c7', padding: 18, borderRadius: 15, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  
  header: { width: '100%', paddingHorizontal: 25, paddingTop: 50, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(51, 65, 85, 0.5)' },
  headerTitle: { fontSize: 24, fontWeight: '900' },
  headerSubtitle: { fontSize: 10, color: '#94a3b8', marginTop: 3, textTransform: 'uppercase', letterSpacing: 1 },
  logoutBtn: { backgroundColor: 'rgba(225, 29, 72, 0.1)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(225, 29, 72, 0.3)' },
  
  scrollArea: { flex: 1, width: '100%', padding: 0 },
  sectionTitle: { fontSize: 28, fontWeight: '900', color: 'white', marginBottom: 20, marginHorizontal: 20, marginTop: 20 },
  
  statCard: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 20, borderRadius: 20, borderWidth: 1, marginHorizontal: 5 },
  statLabel: { fontSize: 10, fontWeight: '900', marginBottom: 10, letterSpacing: 1 },
  statValue: { fontSize: 35, fontWeight: '900', color: 'white' },
  
  cardList: { backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(51, 65, 85, 0.8)', marginBottom: 15, marginHorizontal: 20 },
  islemBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  
  bottomNav: { width: '100%', flexDirection: 'row', backgroundColor: 'rgba(2, 6, 23, 0.95)', borderTopWidth: 1, borderTopColor: 'rgba(51, 65, 85, 0.5)', paddingBottom: 25, paddingTop: 15, justifyContent: 'space-around' },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  navActiveSky: { color: '#38bdf8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  navActiveEmerald: { color: '#34d399', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },

  modalOverlay: { flexGrow: 1, backgroundColor: 'rgba(2, 6, 23, 0.9)', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#0f172a', padding: 30, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)' },
  
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 10, marginBottom: 20, fontSize: 12, fontStyle: 'italic', marginHorizontal: 20 }
});