console.log("JS LOADED");
let supabaseClient = null;

function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(
            "https://cegsatrugfhtiwkasicg.supabase.co",
            "sb_publishable_e6dEu6oTadTIAAK3rKf0qw_eGXXisGK"
        );
    } else {
        console.error("Supabase library not found. Please ensure the CDN script is loaded.");
    }
}

async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                const newWidth = img.width * scale;
                const newHeight = img.height * scale;

                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

async function uploadImageToSupabase(dataUrl, type) {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return null;
    if (!supabaseClient) {
        console.error("Supabase client not initialized.");
        return null;
    }
    
    // PRODUCTION CONFIG: Single bucket, automatic folders
    const BUCKET = 'student-files';
    const folderMap = {
        'student': 'student_photos',
        'family': 'family_photos',
        'id-front': 'id_cards',
        'id-back': 'id_cards',
        'receipt': 'payment_receipts'
    };
    const folder = folderMap[type] || 'misc';

    try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        
        const ext = 'jpg'; 
        const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        
        console.log(`[Upload] Uploading ${type} image to ${BUCKET}/${fileName}...`);
        
        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: false
            });
            
        if (error) throw error;
        
        const { data: publicUrlData } = supabaseClient.storage
            .from(BUCKET)
            .getPublicUrl(fileName);
            
        console.log(`[Upload] Success! URL: ${publicUrlData.publicUrl}`);
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error(`[Upload] Failed to upload ${type}:`, err);
        return null;
    }
}

// Global File Variables for Storage
let studentPhotoFile = null;
let familyPhotoFile = null;
let idFrontFile = null;
let idBackFile = null;
let receiptFile = null;

// Photo Upload Manager Class
class PhotoUploadManager {
    constructor(prefix, type) {
        this.prefix = prefix;
        this.type = type; // Internal type for folder handling
        this.uploadedUrl = null; // Store result after upload
        this.isConfirmed = false;
        this.hasFile = false;
        this.file = null; 
        
        this.card = document.getElementById(prefix + 'UploadCard');
        this.input = document.getElementById(prefix + 'Photo');
        this.placeholder = document.getElementById(prefix + 'UploadPlaceholder');
        this.previewContainer = document.getElementById(prefix + 'PreviewContainer');
        this.previewImg = document.getElementById(prefix + 'Preview');
        
        const capPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        this.btnGallery = document.getElementById('btn' + capPrefix + 'Gallery');
        this.btnRetake = document.getElementById(prefix + 'Retake');
        this.btnUse = document.getElementById(prefix + 'Use');
        this.btnConfirm = document.getElementById(prefix + 'Confirm');
        this.btnCancel = document.getElementById(prefix + 'Cancel');

        this.init();
    }

    init() {
        if (!this.input) return;

        this.btnGallery?.addEventListener('click', () => {
            this.input.click();
        });

        this.input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Compress Image before preview and upload
                    const compressedDataUrl = await compressImage(file);
                    this.previewImg.src = compressedDataUrl;
                    
                    this.placeholder.style.display = 'none';
                    this.previewContainer.style.display = 'block';
                    this.hasFile = true;
                    this.isConfirmed = false;

                    if (this.btnRetake) this.btnRetake.style.display = 'inline-block';
                    if (this.btnUse) this.btnUse.style.display = 'inline-block';
                    if (this.btnConfirm) this.btnConfirm.style.display = 'none';
                    
                    this.card.classList.remove('invalid-field');
                    const err = this.card.parentNode.querySelector('.error-message');
                    if (err) err.style.display = 'none';
                    this.previewContainer.querySelector('.photo-confirmed-msg')?.remove();

                    // FIX: Show relation dropdown when family photo is selected
                    if (this.prefix === 'family') {
                        document.querySelector('.relation-dropdown-wrapper')?.classList.add('visible');
                    }
                } catch (err) {
                    console.error("Image processing error:", err);
                }
            }
        });

        this.btnRetake?.addEventListener('click', () => this.input.click());
        this.btnUse?.addEventListener('click', () => {
            if (this.btnUse) this.btnUse.style.display = 'none';
            if (this.btnConfirm) this.btnConfirm.style.display = 'inline-block';
        });
        this.btnConfirm?.addEventListener('click', () => {
            this.isConfirmed = true;
            if (this.btnConfirm) this.btnConfirm.style.display = 'none';
            if (this.btnUse) this.btnUse.style.display = 'none';
            this.showConfirmedState();
        });
        this.btnCancel?.addEventListener('click', () => this.reset());
    }

    showConfirmedState() {
        if (!this.previewContainer) return;
        let msg = this.previewContainer.querySelector('.photo-confirmed-msg');
        if (!msg) {
            msg = document.createElement('div');
            msg.className = 'photo-confirmed-msg';
            msg.innerHTML = `<span>✔</span> Photo Confirmed`;
            this.previewContainer.appendChild(msg);
        }
    }

    async upload() {
        if (!this.hasFile || !this.isConfirmed) return null;
        this.uploadedUrl = await uploadImageToSupabase(this.previewImg.src, this.type);
        return this.uploadedUrl;
    }

    reset() {
        if (!this.previewContainer || !this.placeholder) return;
        this.previewContainer.style.display = 'none';
        this.placeholder.style.display = 'flex';
        this.isConfirmed = false;
        this.hasFile = false;
        this.file = null;
        this.uploadedUrl = null;
        this.input.value = '';
        if (this.prefix === 'student') studentPhotoFile = null;
        if (this.prefix === 'family') {
            familyPhotoFile = null;
            document.querySelector('.relation-dropdown-wrapper')?.classList.remove('visible');
        }
        if (this.prefix === 'receipt') receiptFile = null;
        this.previewContainer.querySelector('.photo-confirmed-msg')?.remove();
    }
}

class NationalIDUploadManager {
    constructor() {
        this.step = 1;
        this.frontImage = null;
        this.backImage = null;
        this.frontUrl = null;
        this.backUrl = null;
        this.isFullyConfirmed = false;

        this.card = document.getElementById('nationalIDCard');
        this.input = document.getElementById('idFileInput');
        this.placeholder = document.getElementById('idPlaceholder');
        this.previewContainer = document.getElementById('idPreviewContainer');
        this.previewImg = document.getElementById('idPreview');
        this.stepTitle = document.getElementById('idStepTitle');
        this.tabFront = document.getElementById('tabFront');
        this.tabBack = document.getElementById('tabBack');
        this.btnGallery = document.getElementById('btnIDGallery');
        this.btnRetake = document.getElementById('btnIDRetake');
        this.btnUse = document.getElementById('btnIDUse');
        this.btnConfirm = document.getElementById('btnIDConfirm');
        this.btnReset = document.getElementById('btnIDReset');
        this.finalPreview = document.getElementById('finalIDPreview');
        this.finalFront = document.getElementById('imgFinalFront');
        this.finalBack = document.getElementById('imgFinalBack');
        this.btnFullRetake = document.getElementById('btnIDFullRetake');

        this.init();
    }

    init() {
        if (!this.input) return;
        this.btnGallery?.addEventListener('click', () => this.input.click());
        this.input?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const compressedDataUrl = await compressImage(file);
                    if (this.placeholder) this.placeholder.style.display = 'none';
                    if (this.previewImg) this.previewImg.src = compressedDataUrl;
                    if (this.previewContainer) this.previewContainer.style.display = 'block';
                    if (this.btnUse) this.btnUse.style.display = 'inline-block';
                    if (this.btnConfirm) this.btnConfirm.style.display = 'none';
                    if (this.card) {
                        this.card.classList.remove('invalid-field');
                        this.card.classList.add('has-upload');
                    }
                } catch (err) {
                    console.error("ID processing error:", err);
                }
            }
        });
        this.btnRetake?.addEventListener('click', () => this.input?.click());
        this.btnUse?.addEventListener('click', () => {
            if (this.btnUse) this.btnUse.style.display = 'none';
            if (this.btnConfirm) this.btnConfirm.style.display = 'inline-block';
        });
        this.btnConfirm?.addEventListener('click', () => {
            if (this.step === 1) {
                this.frontImage = this.previewImg?.src;
                this.tabFront?.classList.add('completed');
                this.tabFront?.classList.remove('active');
                this.step = 2;
                this.stepTransition();
            } else {
                this.backImage = this.previewImg?.src;
                this.tabBack?.classList.add('completed');
                this.tabBack?.classList.remove('active');
                this.isFullyConfirmed = true;
                this.showFinalState();
            }
        });
        this.btnReset?.addEventListener('click', () => this.reset());
        this.btnFullRetake?.addEventListener('click', () => this.reset());
        this.stepTransition();
    }

    stepTransition() {
        if (this.previewContainer) this.previewContainer.style.display = 'none';
        if (this.placeholder) this.placeholder.style.display = 'flex';
        if (this.stepTitle) {
            this.stepTitle.style.display = 'block';
            if (this.step === 1) {
                this.stepTitle.innerText = "Upload Front Side of ID";
                this.tabFront?.classList.add('active');
                this.tabBack?.classList.remove('active');
            } else {
                this.stepTitle.innerText = "Upload Back Side of ID";
                this.tabBack?.classList.add('active');
            }
        }
    }

    showFinalState() {
        if (this.placeholder) this.placeholder.style.display = 'none';
        if (this.previewContainer) this.previewContainer.style.display = 'none';
        if (this.finalPreview) this.finalPreview.style.display = 'block';
        if (this.finalFront) this.finalFront.src = this.frontImage;
        if (this.finalBack) this.finalBack.src = this.backImage;
        if (this.card) this.card.classList.add('has-upload');
        if (this.stepTitle) this.stepTitle.style.display = 'none';
    }

    async upload() {
        if (!this.frontImage || !this.backImage || !this.isFullyConfirmed) return null;
        this.frontUrl = await uploadImageToSupabase(this.frontImage, 'id-front');
        this.backUrl = await uploadImageToSupabase(this.backImage, 'id-back');
        return { front: this.frontUrl, back: this.backUrl };
    }

    reset() {
        this.step = 1; this.frontImage = null; this.backImage = null;
        this.frontUrl = null; this.backUrl = null;
        idFrontFile = null; idBackFile = null; this.isFullyConfirmed = false;
        if (this.finalPreview) this.finalPreview.style.display = 'none';
        this.tabFront?.classList.remove('active', 'completed');
        this.tabBack?.classList.remove('active', 'completed');
        if (this.card) this.card.classList.remove('has-upload');
        this.stepTransition();
    }
}

// Global instances
let studentPhotoManager, familyPhotoManager, receiptPhotoManager, nationalIDManager;

// Event Functions - Exposed to window for HTML onchange
window.showLevelOptions = function() {
    const levelElement = document.querySelector('input[name="level"]:checked');
    if (!levelElement) return;
    const level = levelElement.value;
    const quran = document.getElementById('quranOptions');
    const kitab = document.getElementById('kitabOptions');
    const amountEl = document.getElementById('paymentAmount');
    
    if (quran) quran.style.display = 'none';
    if (kitab) kitab.style.display = 'none';
    document.querySelectorAll('input[name="levelDetail"]').forEach(el => el.checked = false);

    let amount = 0;
    if (level === 'Quran') { if (quran) quran.style.display = 'block'; amount = 500; }
    else if (level === 'Kitab') { if (kitab) kitab.style.display = 'block'; amount = 600; }
    else if (level === 'Aliifa') { amount = 400; }
    if (amountEl) amountEl.innerText = `ETB ${amount}`;
};

window.showPaymentInfo = function() {
    const methodElement = document.querySelector('input[name="paymentMethod"]:checked');
    if (!methodElement) return;
    const method = methodElement.value;
    const infoContainer = document.getElementById('paymentInfo');
    const receiptSection = document.getElementById('receiptUploadSection');
    
    if (infoContainer) infoContainer.style.display = 'block';
    if (receiptSection) receiptSection.style.display = 'block';
    
    const cardEBirr = document.getElementById('cardEBirr');
    const cardCBE = document.getElementById('cardCBE');
    const cardOromia = document.getElementById('cardOromia');
    
    if (cardEBirr) cardEBirr.style.display = method === 'EBirr' ? 'block' : 'none';
    if (cardCBE) cardCBE.style.display = method === 'CBE' ? 'block' : 'none';
    if (cardOromia) cardOromia.style.display = method === 'Bank of Oromia' ? 'block' : 'none';
};

function showError(el, msg) {
    if (!el) return null;
    el.classList.add('invalid-field');
    let err = el.parentNode.querySelector('.error-message');
    if (!err) {
        err = document.createElement('span');
        err.className = 'error-message';
        el.parentNode.appendChild(err);
    }
    err.innerText = msg;
    err.style.display = 'block';

    const clearError = () => {
        el.classList.remove('invalid-field');
        if (err) err.style.display = 'none';
        console.log(`Cleared error for ${el.id || el.name}`);
    };

    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.addEventListener('input', clearError, { once: true });
        el.addEventListener('change', clearError, { once: true });
        el.addEventListener('focus', clearError, { once: true });
    } else {
        // For radio groups or custom card containers
        el.addEventListener('click', clearError, { once: true });
        el.addEventListener('change', clearError, { once: true });
        
        const children = el.querySelectorAll('input, select');
        children.forEach(child => {
            child.addEventListener('input', clearError, { once: true });
            child.addEventListener('change', clearError, { once: true });
        });
    }
    
    return el;
}

function clearErrors() {
    document.querySelectorAll('.invalid-field').forEach(el => el.classList.remove('invalid-field'));
    document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
}

window.closeModal = function() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('successModal');
    if (overlay) overlay.style.display = 'none';
    if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    // Supabase Initialization
    initSupabase();

    // Initialize Managers with Types
    studentPhotoManager = new PhotoUploadManager('student', 'student');
    familyPhotoManager = new PhotoUploadManager('family', 'family');
    receiptPhotoManager = new PhotoUploadManager('receipt', 'receipt');
    nationalIDManager = new NationalIDUploadManager();

    // Disability Logic (Radio based)
    const disabilityRadios = document.querySelectorAll('input[name="medical_condition"]');
    const otherCont = document.getElementById('disability-other-container');
    const otherInp = document.getElementById('disabilityType');

    disabilityRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.id === 'disabilityOtherCheck') {
                if (otherCont) otherCont.style.display = 'block';
                if (otherInp) otherInp.required = true;
            } else {
                if (otherCont) otherCont.style.display = 'none';
                if (otherInp) {
                    otherInp.value = '';
                    otherInp.required = false;
                }
            }
            if (disabilityRadios.length > 0) {
              const disGroup = document.getElementById('disabilityGroup');
              disGroup?.classList.remove('invalid-field');
              const err = disGroup?.parentNode.querySelector('.error-message');
              if (err) err.style.display = 'none';
            }
        });
    });

    // Simple validation clear for Age
    const ageInput = document.getElementById('age');
    if (ageInput) {
        ageInput.addEventListener('input', () => {
            ageInput.classList.remove('invalid-field');
            const err = ageInput.parentNode.querySelector('.error-message');
            if (err) err.style.display = 'none';
        });
    }





    // Form Submit
    const form = document.getElementById('registrationForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Submit button clicked");
            
            clearErrors();
            let firstErr = null;

            const getVal = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
            const getCheck = name => document.querySelector(`input[name="${name}"]:checked`);

            // Detailed validation logs
            console.log("Validating fields...");

            const nameField = document.getElementById('studentFullName');
            if (!getVal('studentFullName')) firstErr = firstErr || showError(nameField, "Required");
            
            const ageField = document.getElementById('age');
            const ageVal = getVal('age');
            if (!ageVal) {
                firstErr = firstErr || showError(ageField, "Required");
            } else if (isNaN(ageVal) || parseInt(ageVal) <= 0) {
                firstErr = firstErr || showError(ageField, "Invalid age");
            }


            
            const sexGroup = document.getElementById('sexGroup');
            if (!getCheck('sex')) firstErr = firstErr || showError(sexGroup, "Required");
            
            const kebeleField = document.getElementById('kebele');
            if (!getVal('kebele')) firstErr = firstErr || showError(kebeleField, "Required");
            
            const studentTypeGroup = document.getElementById('studentTypeGroup');
            if (!getCheck('studentType')) firstErr = firstErr || showError(studentTypeGroup, "Required");
            
            const phoneField = document.getElementById('phone');
            if (!getVal('phone')) firstErr = firstErr || showError(phoneField, "Required");

            const medicalCondition = getCheck('medical_condition');
            const disGroup = document.getElementById('disabilityGroup');
            if (!medicalCondition) firstErr = firstErr || showError(disGroup, "Required");
            if (medicalCondition?.value === 'Other' && !getVal('disabilityType')) firstErr = firstErr || showError(otherInp, "Required");

            const level = getCheck('level');
            const levelGroup = document.getElementById('levelGroup');
            if (!level) firstErr = firstErr || showError(levelGroup, "Required");
            if (level && (level.value === 'Quran' || level.value === 'Kitab') && !getCheck('levelDetail')) {
                const subOptions = (level.value === 'Quran') ? document.getElementById('quranOptions') : document.getElementById('kitabOptions');
                const subRadioGroup = subOptions ? subOptions.querySelector('.radio-group') : null;
                firstErr = firstErr || showError(subRadioGroup || levelGroup, "Selection Required");
            }

            if (!studentPhotoManager.isConfirmed) firstErr = firstErr || showError(studentPhotoManager.card, "Required");
            if (!familyPhotoManager.isConfirmed) firstErr = firstErr || showError(familyPhotoManager.card, "Required");
            
            const relationField = document.getElementById('guardianRelation');
            if (familyPhotoManager.isConfirmed && relationField && !relationField.value) {
                firstErr = firstErr || showError(relationField, "Required");
            }
            if (!nationalIDManager.isFullyConfirmed) firstErr = firstErr || showError(nationalIDManager.card, "Required");
            
            const pay = getCheck('paymentMethod');
            const payGroup = document.querySelector('.payment-radio-group');
            if (!pay) firstErr = firstErr || showError(payGroup, "Required");
            if (pay && !receiptPhotoManager.isConfirmed) firstErr = firstErr || showError(receiptPhotoManager.card, "Required");

            if (firstErr) { 
                console.warn("Validation failed at:", firstErr.id || firstErr.name);
                firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
                return; 
            }

            console.log("Validation passed successfully");

            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = "Submitting..."; btn.disabled = true;

            try {
                console.log("Starting production-grade automated image uploads...");
                
                const sUrl = await studentPhotoManager.upload();
                const fUrl = await familyPhotoManager.upload();
                const idUrls = await nationalIDManager.upload();
                const rUrl = await receiptPhotoManager.upload();

                if (!sUrl || !fUrl || !idUrls || !rUrl) {
                    throw new Error("One or more uploads failed. Please check your internet and try again.");
                }

                console.log("All images uploaded successfully. Sending data to Supabase database...");

                const formData = {
                    full_name: getVal('studentFullName'),
                    age: parseInt(getVal('age')),
                    kebele: getVal('kebele'),
                    sex: getCheck('sex').value,

                    phone: getVal('phone'),
                    student_type: getCheck('studentType').value,
                    medical_condition: (getCheck('medical_condition').value === 'Other') ? getVal('disabilityType') : getCheck('medical_condition').value,
                    level_of_study: level.value + (getCheck('levelDetail') ? ` - ${getCheck('levelDetail').value}` : ''),
                    payment_method: pay.value,
                    relation_to_student: getVal('guardianRelation'),
                    student_photo_url: sUrl,
                    family_photo_url: fUrl,
                    id_front_url: idUrls.front,
                    id_back_url: idUrls.back,
                    receipt_url: rUrl
                };

                console.log("Final data being sent to Supabase:", formData);

                const { error } = await supabaseClient.from('students').insert([formData]);
                
                if (error) {
                    console.error("Supabase Insertion Error:", error);
                    throw error;
                }

                console.log("Registration data saved successfully");

                // SHOW SUCCESS MODAL
                const overlay = document.getElementById('overlay');
                const successModal = document.getElementById('successModal');
                if (overlay) overlay.style.display = 'block';
                if (successModal) successModal.style.display = 'block';

                form.reset();
                studentPhotoManager.reset(); 
                familyPhotoManager.reset(); 
                receiptPhotoManager.reset(); 
                nationalIDManager.reset();
                window.showLevelOptions(); // Reset fee display

            } catch (err) {
                console.error("Critical Registration Error:", err);
                const msg = err.message || JSON.stringify(err);
                alert("Critical Error: Registration Failed\n" + msg + "\n\nPlease show this to the admin.");
            } finally {
                btn.innerText = originalText; 
                btn.disabled = false;
            }


        });
    }

    // Registration Logic...
});
