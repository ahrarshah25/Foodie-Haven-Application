import {
    auth,
    db,
    onAuthStateChanged,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    addDoc,
    serverTimestamp,
    onSnapshot,
    increment,
    arrayUnion
} from "../Firebase/config.js";
import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";
import orderAlert from "../api/Order-Alert/orderAlert.api.js";

let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let selectedPaymentMethod = "cod";
let selectedDeliveryTime = "asap";
let selectedAddress = null;
let promoApplied = false;
let promoDiscount = 0;
let appliedPromoMeta = null;
let userAddresses = [];
let shopsCache = {};

const DELIVERY_FEE = 150;
const SERVICE_FEE = 50;

const getStableAuthUser = async (maxWaitMs = 6000, intervalMs = 300) => {
    if (auth.currentUser) return auth.currentUser;

    const maxTicks = Math.ceil(maxWaitMs / intervalMs);

    for (let tick = 0; tick < maxTicks; tick++) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        if (auth.currentUser) return auth.currentUser;
    }

    return null;
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        user = await getStableAuthUser();
    }

    if (!user) {
        notyf.error("Please login to checkout");
        setTimeout(() => {
            window.location.href = "/account-type";
        }, 2000);
        return;
    }

    currentUser = user;

    if (cart.length === 0) {
        notyf.error("Your cart is empty");
        setTimeout(() => {
            window.location.href = "/shop";
        }, 2000);
        return;
    }

    try {
        const loading = showLoading(notyf, "Loading checkout...");

        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            notyf.dismiss(loading);
            notyf.error("User data not found");
            return;
        }

        const userData = userDoc.data();
        await loadUserAddresses(userData);
        await loadShopsData();

        notyf.dismiss(loading);

        renderOrderItems();
        calculateTotals();
        setupEventListeners();
        setupDatePicker();
    } catch (error) {
        notyf.error("Error loading checkout: " + error.message);
    }
});

async function loadUserAddresses(userData) {
    userAddresses = Array.isArray(userData.addresses) ? userData.addresses : [];

    renderAddresses();
}

async function loadShopsData() {
    const shopIds = [...new Set(cart.map(item => item.shopId))];

    for (const shopId of shopIds) {
        if (!shopsCache[shopId]) {
            try {
                const shopDoc = await getDoc(doc(db, "shops", shopId));
                if (shopDoc.exists()) {
                    shopsCache[shopId] = shopDoc.data();
                }
            } catch (error) {
                console.error("Error loading shop data:", error);
            }
        }
    }
}

const calculateSubtotal = () =>
    cart.reduce((sum, item) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const variationsTotal =
            (item.selectedVariations || []).reduce((s, v) => s + (v.price || 0), 0) *
            (item.quantity || 1);
        return sum + itemTotal + variationsTotal;
    }, 0);

const calculateShopSubtotal = (targetShopId) =>
    cart.reduce((sum, item) => {
        if (item.shopId !== targetShopId) return sum;
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const variationsTotal =
            (item.selectedVariations || []).reduce((s, v) => s + (v.price || 0), 0) *
            (item.quantity || 1);
        return sum + itemTotal + variationsTotal;
    }, 0);

function renderAddresses() {
    const addressOptions = document.getElementById("addressOptions");
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    if (!addressOptions) return;

    if (!userAddresses.length) {
        selectedAddress = null;
        if (placeOrderBtn) {
            placeOrderBtn.disabled = true;
            placeOrderBtn.innerHTML = '<span>Add Address to Continue</span><i class="fas fa-map-marker-alt"></i>';
        }
        addressOptions.innerHTML = `
            <div class="empty-cart" style="text-align:left; margin:0;">
                <strong style="display:block; margin-bottom:6px;">No saved address found</strong>
                <p style="color: var(--text-light);">Please add a delivery address to place your order.</p>
            </div>
        `;
        return;
    }

    addressOptions.innerHTML = userAddresses.map((addr, index) => `
        <label class="address-card ${index === 0 ? 'selected' : ''}">
            <input type="radio" name="address" value="${addr.id || index}" ${index === 0 ? 'checked' : ''} hidden>
            <div class="address-badge">
                <i class="fas fa-${addr.type === 'home' ? 'home' : addr.type === 'work' ? 'briefcase' : 'map-pin'}"></i>
                <span>${addr.type.charAt(0).toUpperCase() + addr.type.slice(1)}</span>
            </div>
            <div class="address-details">
                <p class="address-name">${addr.name}</p>
                <p class="address-line">${addr.line1}</p>
                <p class="address-line">${addr.line2}</p>
                <p class="address-phone">${addr.phone}</p>
            </div>
            <div class="address-check">
                <i class="fas fa-check-circle"></i>
            </div>
        </label>
    `).join('');

    if (userAddresses.length > 0) {
        selectedAddress = userAddresses[0];
        if (placeOrderBtn) {
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = '<span>Place Order</span><i class="fas fa-arrow-right"></i>';
        }
    }

    document.querySelectorAll('input[name="address"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.address-card').forEach(card => {
                card.classList.remove('selected');
            });
            e.target.closest('.address-card').classList.add('selected');
            const selectedValue = e.target.value;
            selectedAddress =
                userAddresses.find((addr, idx) => String(addr.id || idx) === selectedValue) ||
                null;
        });
    });
}

function renderOrderItems() {
    const container = document.getElementById("orderItems");

    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        return;
    }

    container.innerHTML = cart.map((item, index) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const variationsTotal = (item.selectedVariations || []).reduce((sum, v) => sum + (v.price || 0), 0) * (item.quantity || 1);
        const total = itemTotal + variationsTotal;
        const shop = shopsCache[item.shopId] || {};

        return `
            <div class="cart-item" data-index="${index}">
                <div class="item-image">
                    <img src="${item.image || 'https://res.cloudinary.com/dnkuvmxuv/image/upload/v1770992966/default_food_qvzrjl.png'}" alt="${item.name}">
                </div>
                <div class="item-details">
                    <h4>${item.name}</h4>
                    <small style="color: var(--primary-yellow); display: block; margin-bottom: 4px;">${shop.shopName || 'Foodie Haven'}</small>
                    ${item.selectedVariations?.length > 0 ? `
                        <div class="item-variations">
                            ${item.selectedVariations.map(v => `+ ${v.name}`).join(', ')}
                        </div>
                    ` : ''}
                    <div class="item-price">PKR ${total.toLocaleString()}</div>
                </div>
                <div class="item-quantity">x${item.quantity}</div>
            </div>
        `;
    }).join('');
}

function calculateTotals() {
    const subtotal = calculateSubtotal();

    const deliveryFee = selectedDeliveryTime === 'asap' ? DELIVERY_FEE : 0;
    const serviceFee = SERVICE_FEE;
    const discount = promoDiscount;
    const total = subtotal + deliveryFee + serviceFee - discount;

    document.getElementById('subtotal').textContent = `PKR ${subtotal.toLocaleString()}`;
    document.getElementById('deliveryFee').textContent = `PKR ${deliveryFee.toLocaleString()}`;
    document.getElementById('serviceFee').textContent = `PKR ${serviceFee.toLocaleString()}`;

    if (discount > 0) {
        document.getElementById('discountRow').style.display = 'flex';
        document.getElementById('discountAmount').textContent = `-PKR ${discount.toLocaleString()}`;
    } else {
        document.getElementById('discountRow').style.display = 'none';
    }

    document.getElementById('totalAmount').textContent = `PKR ${total.toLocaleString()}`;
}

function setupEventListeners() {
    document.querySelectorAll('input[name="deliveryTime"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.delivery-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            e.target.closest('.delivery-option').classList.add('selected');
            selectedDeliveryTime = e.target.value;

            document.getElementById('timePicker').style.display =
                selectedDeliveryTime === 'scheduled' ? 'block' : 'none';

            calculateTotals();
        });
    });

    document.querySelectorAll('input[name="payment"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.payment-card').forEach(card => {
                card.classList.remove('selected');
            });
            e.target.closest('.payment-card').classList.add('selected');
            selectedPaymentMethod = e.target.value;
        });
    });

    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', function() {
            document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
            this.classList.add('selected');
        });
    });

    document.getElementById('applyPromo').addEventListener('click', applyPromoCode);

    document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);

    document.getElementById('addAddressBtn').addEventListener('click', showAddAddressForm);

}

function setupDatePicker() {
    const dateInput = document.getElementById('deliveryDate');
    if (dateInput) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const formattedDate = tomorrow.toISOString().split('T')[0];
        dateInput.min = formattedDate;
        dateInput.value = formattedDate;
    }
}

function applyPromoCode() {
    applyPromoCodeInternal().catch((error) => {
        console.error("Promo code apply failed:", error);
        notyf.error("Failed to apply promo code");
    });
}

async function applyPromoCodeInternal() {
    const promoInput = document.getElementById('promoCode');
    const code = promoInput.value.trim().toUpperCase();

    if (!code) {
        notyf.error("Please enter a promo code");
        return;
    }

    const subtotal = calculateSubtotal();
    const cartShopIds = [...new Set(cart.map((item) => item.shopId).filter(Boolean))];

    const promoSnap = await getDocs(
        query(
            collection(db, "promoCodes"),
            where("code", "==", code),
            limit(20),
        ),
    );

    if (promoSnap.empty) {
        notyf.error("Invalid promo code");
        return;
    }

    const now = Date.now();
    let selectedPromo = null;

    promoSnap.forEach((promoDoc) => {
        if (selectedPromo) return;
        const promo = { id: promoDoc.id, ...promoDoc.data() };

        if (promo.isActive === false) return;

        if (promo.shopId && !cartShopIds.includes(promo.shopId)) return;

        const startsAtMs = promo.startsAt?.toDate?.()?.getTime?.() || null;
        const expiresAtMs = promo.expiresAt?.toDate?.()?.getTime?.() || null;

        if (startsAtMs && now < startsAtMs) return;
        if (expiresAtMs && now > expiresAtMs) return;

        const usedCount = promo.usedCount || 0;
        if (promo.usageLimit && usedCount >= promo.usageLimit) return;

        const promoBaseSubtotal = promo.shopId
            ? calculateShopSubtotal(promo.shopId)
            : subtotal;

        if (promo.minOrder && promoBaseSubtotal < promo.minOrder) return;

        selectedPromo = { ...promo, promoBaseSubtotal };
    });

    if (!selectedPromo) {
        notyf.error("Promo code is not applicable right now");
        return;
    }

    if (selectedPromo.type === "percent") {
        promoDiscount = Math.round((selectedPromo.promoBaseSubtotal * (selectedPromo.value || 0)) / 100);
        if (selectedPromo.maxDiscount) {
            promoDiscount = Math.min(promoDiscount, selectedPromo.maxDiscount);
        }
    } else {
        promoDiscount = Math.min(selectedPromo.value || 0, selectedPromo.promoBaseSubtotal);
    }

    if (promoDiscount <= 0) {
        notyf.error("Promo code is not applicable");
        return;
    }

    promoApplied = true;
    appliedPromoMeta = selectedPromo;
    notyf.success(`Promo code applied! You saved PKR ${promoDiscount.toLocaleString()}`);

    promoInput.disabled = true;
    document.getElementById('applyPromo').disabled = true;
    calculateTotals();
}

const notifyVendorsOnOrder = async (orderId, orderItems, orderData) => {
    const shopIds = [...new Set(orderItems.map((item) => item.shopId).filter(Boolean))];

    const tasks = shopIds.map(async (currentShopId) => {
        const shop = shopsCache[currentShopId] || {};
        const vendorEmail = shop.contactEmail || shop.vendorEmail;
        if (!vendorEmail) return;

        const vendorItems = orderItems
            .filter((item) => item.shopId === currentShopId)
            .map((item) => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
            }));

        await orderAlert({
            vendorEmail,
            shopName: shop.shopName || "Foodie Haven Vendor",
            orderId,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            customerEmail: orderData.customerEmail,
            shippingAddress: orderData.shippingAddress,
            deliveryTime: orderData.deliveryTime,
            paymentMethod: orderData.paymentMethod,
            orderNotes: orderData.orderNotes || "",
            total: orderData.total,
            subtotal: orderData.subtotal,
            items: vendorItems,
        });
    });

    await Promise.allSettled(tasks);
};

function showAddAddressForm() {
    Swal.fire({
        title: 'Add New Address',
        html: `
            <div style="text-align: left; padding: 0 10px;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Address Type</label>
                    <select id="newAddressType" class="swal2-select" style="width: 100%; padding: 10px;">
                        <option value="home">Home</option>
                        <option value="work">Work</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Full Name</label>
                    <input type="text" id="newAddressName" class="swal2-input" placeholder="Full Name" style="width: 100%;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Street Address</label>
                    <input type="text" id="newAddressLine1" class="swal2-input" placeholder="House/Flat No., Street" style="width: 100%;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Area, City</label>
                    <input type="text" id="newAddressLine2" class="swal2-input" placeholder="Area, City" style="width: 100%;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Phone Number</label>
                    <input type="tel" id="newAddressPhone" class="swal2-input" placeholder="03XX XXXXXXX" style="width: 100%;">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#FFD700',
        cancelButtonColor: '#666',
        confirmButtonText: 'Add Address',
        preConfirm: () => {
            const type = document.getElementById('newAddressType').value;
            const name = document.getElementById('newAddressName').value;
            const line1 = document.getElementById('newAddressLine1').value;
            const line2 = document.getElementById('newAddressLine2').value;
            const phone = document.getElementById('newAddressPhone').value;

            if (!name || !line1 || !line2 || !phone) {
                Swal.showValidationMessage('All fields are required');
                return false;
            }

            const phoneRegex = /^03[0-9]{9}$/;
            if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
                Swal.showValidationMessage('Invalid phone number format');
                return false;
            }

            return { type, name, line1, line2, phone };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const newAddress = result.value;

            try {
                const loading = showLoading(notyf, "Saving address...");

                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, {
                    addresses: arrayUnion(newAddress)
                });

                notyf.dismiss(loading);
                notyf.success("Address added successfully");

                userAddresses.push(newAddress);
                renderAddresses();

            } catch (error) {
                notyf.error("Failed to save address: " + error.message);
            }
        }
    });
}

async function placeOrder() {
    if (!document.getElementById('termsAgreement').checked) {
        notyf.error('Please agree to the Terms of Service');
        return;
    }

    if (!selectedAddress) {
        notyf.error('Please add/select a delivery address');
        return;
    }

    const loading = showLoading(notyf, 'Processing your order...');

    try {
        let selectedTimeSlot = 'ASAP';
        if (selectedDeliveryTime === 'scheduled') {
            const date = document.getElementById('deliveryDate').value;
            const selectedSlot = document.querySelector('.time-slot.selected');
            const timeSlot = selectedSlot ? selectedSlot.dataset.time : '12:00-14:00';
            selectedTimeSlot = `${date} (${timeSlot})`;
        }

        const orderItems = cart.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            variations: item.selectedVariations || [],
            shopId: item.shopId,
            shopName: shopsCache[item.shopId]?.shopName || 'Foodie Haven'
        }));

        const subtotal = calculateSubtotal();

        const deliveryFee = selectedDeliveryTime === 'asap' ? DELIVERY_FEE : 0;
        const serviceFee = SERVICE_FEE;
        const total = subtotal + deliveryFee + serviceFee - promoDiscount;

        const orderData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName || selectedAddress.name,
            customerName: selectedAddress.name,
            customerPhone: selectedAddress.phone,
            customerEmail: currentUser.email,
            shippingAddress: `${selectedAddress.line1}, ${selectedAddress.line2}`,
            deliveryAddress: {
                type: selectedAddress.type || "home",
                name: selectedAddress.name || "",
                phone: selectedAddress.phone || "",
                line1: selectedAddress.line1 || "",
                line2: selectedAddress.line2 || "",
            },
            items: orderItems,
            deliveryTime: selectedTimeSlot,
            paymentMethod: 'cod',
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            serviceFee: serviceFee,
            discount: promoDiscount,
            total: total,
            promoCode: promoApplied ? document.getElementById('promoCode').value : null,
            orderNotes: document.getElementById('orderNotes')?.value?.trim() || "",
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            shopIds: [...new Set(orderItems.map(item => item.shopId))]
        };

        const orderRef = await addDoc(collection(db, 'orders'), orderData);

        if (promoApplied && appliedPromoMeta?.id) {
            updateDoc(doc(db, "promoCodes", appliedPromoMeta.id), {
                usedCount: increment(1),
                updatedAt: serverTimestamp(),
            }).catch((error) => {
                console.error("Promo usage update failed:", error);
            });
        }

        notifyVendorsOnOrder(orderRef.id, orderItems, orderData).catch((error) => {
            console.error("Vendor order notification failed:", error);
        });

        for (const shopId of orderData.shopIds) {
            const shopRef = doc(db, 'shops', shopId);
            await updateDoc(shopRef, {
                totalOrders: increment(1),
                updatedAt: serverTimestamp()
            });
        }

        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            recentOrders: arrayUnion(orderRef.id),
            updatedAt: serverTimestamp()
        });

        notyf.dismiss(loading);

        localStorage.removeItem('cart');
        cart = [];

        const orderId = orderRef.id;
        const formattedOrderId = `ORD-${new Date().getFullYear()}-${orderId.slice(-6)}`;

        document.getElementById('orderId').textContent = formattedOrderId;
        document.getElementById('estimatedDeliveryTime').textContent =
            selectedDeliveryTime === 'asap' ? '45-60 minutes' : selectedTimeSlot;

        document.getElementById('orderSuccessModal').classList.add('show');

    } catch (error) {
        notyf.dismiss(loading);
        console.error("Error placing order:", error);
        notyf.error('Failed to place order: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('orderSuccessModal');

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('show');
            });
        });
    });
});
