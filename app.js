// Store Application
document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let customers = {};
    let purchases = {};
    let currentCustomerId = null;
    let itemCounter = 1;
    let isLoggedIn = false;
    let storePassword = "balaji123"; // Default password, change this!
    
    // Initialize the application
    initApp();
    
    function initApp() {
        setupEventListeners();
        updateDateTime();
        setInterval(updateDateTime, 60000); // Update time every minute
        
        // Check if already logged in
        const savedPassword = localStorage.getItem('store_password');
        if (savedPassword === storePassword) {
            loginSuccess();
        } else {
            // Show login screen
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('main-app').style.display = 'none';
        }
    }
    
    // Login functionality
    document.getElementById('login-btn').addEventListener('click', function() {
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        
        if (password === storePassword) {
            localStorage.setItem('store_password', password);
            loginSuccess();
        } else {
            errorElement.style.display = 'block';
            document.getElementById('login-password').value = '';
            document.getElementById('login-password').focus();
        }
    });
    
    // Enter key for login
    document.getElementById('login-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('login-btn').click();
        }
    });
    
    function loginSuccess() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        isLoggedIn = true;
        
        // Try to connect to Firebase
        if (typeof loginToFirebase === 'function') {
            loginToFirebase().catch(error => {
                console.log("Firebase login failed, using local storage");
                showMessage('customer-form-message', 
                    'Firebase connection failed. Using local storage mode.', 
                    'info');
            });
        }
        
        // Initialize Firebase connection check
        if (typeof checkFirebaseConnection === 'function') {
            checkFirebaseConnection();
        }
        
        // Load data
        loadData();
        
        // Add login activity
        addActivity('Store owner logged in');
    }
    
    // Logout functionality
    document.getElementById('logout-btn').addEventListener('click', function() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('store_password');
            location.reload();
        }
    });
    
    // Setup all event listeners
    function setupEventListeners() {
        setupNavigation();
        setupCustomerForm();
        setupPurchaseForm();
        setupSearch();
        setupReports();
        setupModalEvents();
    }
    
    // Navigation
    function setupNavigation() {
        const navButtons = {
            'nav-add-customer': 'add-customer-section',
            'nav-view-customers': 'view-customers-section',
            'nav-add-purchase': 'add-purchase-section',
            'nav-search-customer': 'search-customer-section',
            'nav-reports': 'reports-section'
        };
        
        Object.keys(navButtons).forEach(buttonId => {
            document.getElementById(buttonId).addEventListener('click', function() {
                // Remove active class from all
                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
                
                // Add active class to clicked
                this.classList.add('active');
                document.getElementById(navButtons[buttonId]).classList.add('active');
                
                // Load data if needed
                if (buttonId === 'nav-view-customers') {
                    loadCustomersTable();
                } else if (buttonId === 'nav-add-purchase') {
                    loadCustomerOptions();
                } else if (buttonId === 'nav-reports') {
                    loadReports();
                }
            });
        });
    }
    
    // Customer Form
    function setupCustomerForm() {
        const customerForm = document.getElementById('customer-form');
        const resetButton = document.getElementById('reset-form');
        
        customerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!isLoggedIn) {
                alert('Please login first');
                return;
            }
            
            const name = document.getElementById('customer-name').value.trim();
            const phone = document.getElementById('customer-phone').value.trim();
            const address = document.getElementById('customer-address').value.trim();
            const notes = document.getElementById('customer-notes').value.trim();
            
            // Validation
            if (!name || !phone) {
                showMessage('customer-form-message', 'Please fill all required fields', 'error');
                return;
            }
            
            if (!/^\d{10}$/.test(phone)) {
                showMessage('customer-form-message', 'Please enter a valid 10-digit phone number', 'error');
                return;
            }
            
            // Check if customer already exists
            const existingCustomer = Object.values(customers).find(c => c.phone === phone);
            if (existingCustomer) {
                showMessage('customer-form-message', 
                    `Customer with phone ${phone} already exists: ${existingCustomer.name}`, 
                    'error');
                return;
            }
            
            // Create customer data
            const customerData = {
                name: name,
                phone: phone,
                address: address || 'Not provided',
                notes: notes || 'No notes',
                createdAt: new Date().toISOString(),
                totalPurchases: 0,
                totalAmount: 0,
                lastPurchase: 'Never',
                updatedAt: new Date().toISOString()
            };
            
            // Generate ID
            const customerId = 'customer_' + Date.now();
            
            // Show saving message
            showMessage('customer-form-message', 'Saving customer...', 'info');
            
            try {
                // Try Firebase first
                if (database && auth && auth.currentUser) {
                    await database.ref('customers/' + customerId).set(customerData);
                } else {
                    // Fallback to localStorage
                    customers[customerId] = customerData;
                    localStorage.setItem('store_customers', JSON.stringify(customers));
                }
                
                showMessage('customer-form-message', 
                    `Customer "${name}" added successfully!`, 
                    'success');
                
                addActivity(`Added new customer: ${name}`);
                customerForm.reset();
                
                // Switch to view customers after 2 seconds
                setTimeout(() => {
                    document.getElementById('nav-view-customers').click();
                }, 2000);
                
            } catch (error) {
                console.error('Error saving customer:', error);
                showMessage('customer-form-message', 
                    'Error saving customer. Please try again.', 
                    'error');
            }
        });
        
        resetButton.addEventListener('click', function() {
            customerForm.reset();
            document.getElementById('customer-form-message').style.display = 'none';
        });
    }
    
    // Purchase Form
    function setupPurchaseForm() {
        const purchaseForm = document.getElementById('purchase-form');
        const addItemButton = document.getElementById('add-item');
        const clearButton = document.getElementById('clear-purchase-form');
        const quickAddCustomer = document.getElementById('quick-add-customer');
        
        purchaseForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!isLoggedIn) {
                alert('Please login first');
                return;
            }
            
            const customerId = document.getElementById('purchase-customer').value;
            const paymentMode = document.getElementById('payment-mode').value;
            const purchaseDate = document.getElementById('purchase-date').value || new Date().toISOString().split('T')[0];
            const notes = document.getElementById('purchase-notes').value.trim();
            const discount = parseFloat(document.getElementById('discount').value) || 0;
            const discountType = document.getElementById('discount-type').value;
            
            if (!customerId) {
                showMessage('purchase-form-message', 'Please select a customer', 'error');
                return;
            }
            
            // Collect items
            const items = [];
            let subtotal = 0;
            let totalQuantity = 0;
            
            document.querySelectorAll('.purchase-item').forEach(item => {
                const name = item.querySelector('.item-name').value.trim();
                const quantity = parseFloat(item.querySelector('.item-quantity').value);
                const price = parseFloat(item.querySelector('.item-price').value);
                
                if (name && quantity > 0 && price > 0) {
                    const itemTotal = quantity * price;
                    items.push({
                        name: name,
                        quantity: quantity,
                        price: price,
                        total: itemTotal
                    });
                    
                    totalQuantity += quantity;
                    subtotal += itemTotal;
                }
            });
            
            if (items.length === 0) {
                showMessage('purchase-form-message', 'Please add at least one item', 'error');
                return;
            }
            
            // Calculate discount
            let finalAmount = subtotal;
            if (discount > 0) {
                if (discountType === 'percent') {
                    finalAmount = subtotal * (1 - discount / 100);
                } else {
                    finalAmount = subtotal - discount;
                }
            }
            
            if (finalAmount < 0) finalAmount = 0;
            
            const customer = customers[customerId];
            if (!customer) {
                showMessage('purchase-form-message', 'Customer not found', 'error');
                return;
            }
            
            // Create purchase data
            const purchaseData = {
                customerId: customerId,
                customerName: customer.name,
                items: items,
                subtotal: subtotal,
                discount: discount,
                discountType: discountType,
                totalAmount: finalAmount,
                totalQuantity: totalQuantity,
                paymentMode: paymentMode,
                purchaseDate: purchaseDate,
                notes: notes || 'No notes',
                timestamp: Date.now(),
                createdAt: new Date().toISOString()
            };
            
            const purchaseId = 'purchase_' + Date.now();
            
            showMessage('purchase-form-message', 'Saving purchase...', 'info');
            
            try {
                // Save purchase
                if (database && auth && auth.currentUser) {
                    await database.ref('purchases/' + purchaseId).set(purchaseData);
                    
                    // Update customer
                    const customerRef = database.ref('customers/' + customerId);
                    await customerRef.update({
                        totalPurchases: (customer.totalPurchases || 0) + 1,
                        totalAmount: (customer.totalAmount || 0) + finalAmount,
                        lastPurchase: new Date().toLocaleDateString('en-IN'),
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    // Local storage
                    purchases[purchaseId] = purchaseData;
                    localStorage.setItem('store_purchases', JSON.stringify(purchases));
                    
                    // Update customer locally
                    customers[customerId].totalPurchases = (customers[customerId].totalPurchases || 0) + 1;
                    customers[customerId].totalAmount = (customers[customerId].totalAmount || 0) + finalAmount;
                    customers[customerId].lastPurchase = new Date().toLocaleDateString('en-IN');
                    customers[customerId].updatedAt = new Date().toISOString();
                    localStorage.setItem('store_customers', JSON.stringify(customers));
                }
                
                showMessage('purchase-form-message', 
                    `Purchase saved for ${customer.name}! Total: ₹${finalAmount.toFixed(2)}`, 
                    'success');
                
                addActivity(`Added purchase for ${customer.name} - ₹${finalAmount.toFixed(2)}`);
                
                // Reset form
                setTimeout(() => {
                    purchaseForm.reset();
                    resetPurchaseForm();
                    loadCustomerOptions();
                    updatePurchaseSummary();
                }, 2000);
                
            } catch (error) {
                console.error('Error saving purchase:', error);
                showMessage('purchase-form-message', 'Error saving purchase', 'error');
            }
        });
        
        addItemButton.addEventListener('click', addPurchaseItem);
        clearButton.addEventListener('click', resetPurchaseForm);
        
        quickAddCustomer.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('nav-add-customer').click();
        });
        
        // Quantity controls
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('quantity-btn')) {
                const input = e.target.parentElement.querySelector('.item-quantity');
                const value = parseInt(input.value) || 0;
                
                if (e.target.classList.contains('plus')) {
                    input.value = value + 1;
                } else if (e.target.classList.contains('minus') && value > 1) {
                    input.value = value - 1;
                }
                
                updatePurchaseSummary();
            }
            
            if (e.target.classList.contains('btn-remove-item')) {
                const item = e.target.closest('.purchase-item');
                if (item && document.querySelectorAll('.purchase-item').length > 1) {
                    item.remove();
                    updatePurchaseSummary();
                }
            }
        });
        
        // Real-time summary update
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('item-name') || 
                e.target.classList.contains('item-quantity') || 
                e.target.classList.contains('item-price') ||
                e.target.id === 'discount') {
                updatePurchaseSummary();
            }
        });
    }
    
    function addPurchaseItem() {
        itemCounter++;
        const newItem = document.createElement('div');
        newItem.className = 'purchase-item';
        newItem.innerHTML = `
            <div class="item-header">
                <span>Item #${itemCounter}</span>
                <button type="button" class="btn-remove-item">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="item-name-${itemCounter}">Item Name *</label>
                    <input type="text" id="item-name-${itemCounter}" class="item-name" placeholder="Enter item name" required>
                </div>
                <div class="form-group">
                    <label for="item-quantity-${itemCounter}">Quantity *</label>
                    <div class="quantity-control">
                        <button type="button" class="quantity-btn minus">-</button>
                        <input type="number" id="item-quantity-${itemCounter}" class="item-quantity" min="1" value="1" required>
                        <button type="button" class="quantity-btn plus">+</button>
                    </div>
                </div>
                <div class="form-group">
                    <label for="item-price-${itemCounter}">Price per item (₹) *</label>
                    <input type="number" id="item-price-${itemCounter}" class="item-price" min="0.01" step="0.01" placeholder="0.00" required>
                </div>
            </div>
        `;
        
        document.getElementById('purchase-items-container').appendChild(newItem);
        updatePurchaseSummary();
    }
    
    function resetPurchaseForm() {
        document.getElementById('purchase-form').reset();
        document.getElementById('purchase-items-container').innerHTML = `
            <div class="purchase-item">
                <div class="item-header">
                    <span>Item #1</span>
                    <button type="button" class="btn-remove-item" disabled>
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="item-name-1">Item Name *</label>
                        <input type="text" id="item-name-1" class="item-name" placeholder="Enter item name" required>
                    </div>
                    <div class="form-group">
                        <label for="item-quantity-1">Quantity *</label>
                        <div class="quantity-control">
                            <button type="button" class="quantity-btn minus">-</button>
                            <input type="number" id="item-quantity-1" class="item-quantity" min="1" value="1" required>
                            <button type="button" class="quantity-btn plus">+</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="item-price-1">Price per item (₹) *</label>
                        <input type="number" id="item-price-1" class="item-price" min="0.01" step="0.01" placeholder="0.00" required>
                    </div>
                </div>
            </div>
        `;
        
        itemCounter = 1;
        document.getElementById('purchase-date').value = new Date().toISOString().split('T')[0];
        updatePurchaseSummary();
        document.getElementById('purchase-form-message').style.display = 'none';
    }
    
    function updatePurchaseSummary() {
        let totalItems = 0;
        let totalQuantity = 0;
        let subtotal = 0;
        
        document.querySelectorAll('.purchase-item').forEach(item => {
            const name = item.querySelector('.item-name').value.trim();
            const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
            const price = parseFloat(item.querySelector('.item-price').value) || 0;
            
            if (name) totalItems++;
            totalQuantity += quantity;
            subtotal += quantity * price;
        });
        
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        const discountType = document.getElementById('discount-type').value;
        let finalAmount = subtotal;
        
        if (discount > 0) {
            if (discountType === 'percent') {
                finalAmount = subtotal * (1 - discount / 100);
            } else {
                finalAmount = subtotal - discount;
            }
        }
        
        if (finalAmount < 0) finalAmount = 0;
        
        document.getElementById('total-items').textContent = totalItems;
        document.getElementById('total-quantity').textContent = totalQuantity;
        document.getElementById('subtotal-amount').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('total-amount').textContent = `₹${finalAmount.toFixed(2)}`;
    }
    
    // Search functionality
    function setupSearch() {
        const searchButton = document.getElementById('search-btn');
        const searchInput = document.getElementById('customer-search');
        const advancedToggle = document.getElementById('advanced-search-toggle');
        const applyFilters = document.getElementById('apply-filters');
        
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performSearch();
        });
        
        advancedToggle.addEventListener('click', function() {
            const advancedSearch = document.getElementById('advanced-search');
            advancedSearch.style.display = advancedSearch.style.display === 'none' ? 'block' : 'none';
        });
        
        applyFilters.addEventListener('click', performSearch);
    }
    
    function performSearch() {
        const searchTerm = document.getElementById('customer-search').value.trim().toLowerCase();
        const fromDate = document.getElementById('search-from-date').value;
        const toDate = document.getElementById('search-to-date').value;
        const minAmount = parseFloat(document.getElementById('min-amount').value) || 0;
        const maxAmount = parseFloat(document.getElementById('max-amount').value) || Infinity;
        
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = '';
        
        if (!searchTerm && !fromDate && !toDate && minAmount === 0 && maxAmount === Infinity) {
            resultsDiv.innerHTML = '<div class="no-results">Please enter search criteria</div>';
            return;
        }
        
        const filteredCustomers = Object.keys(customers).filter(id => {
            const customer = customers[id];
            let matches = true;
            
            // Text search
            if (searchTerm) {
                matches = customer.name.toLowerCase().includes(searchTerm) || 
                         customer.phone.includes(searchTerm) ||
                         customer.address.toLowerCase().includes(searchTerm);
            }
            
            // Amount filter
            if (matches) {
                matches = (customer.totalAmount || 0) >= minAmount && 
                         (customer.totalAmount || 0) <= maxAmount;
            }
            
            return matches;
        });
        
        if (filteredCustomers.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">No customers found matching your criteria</div>';
            return;
        }
        
        resultsDiv.innerHTML = `<h3>Search Results (${filteredCustomers.length} found)</h3>`;
        
        filteredCustomers.forEach(id => {
            const customer = customers[id];
            const customerCard = document.createElement('div');
            customerCard.className = 'search-result-card';
            customerCard.innerHTML = `
                <div class="result-card-header">
                    <h4>${customer.name}</h4>
                    <span class="result-phone">${customer.phone}</span>
                </div>
                <div class="result-card-body">
                    <p><i class="fas fa-map-marker-alt"></i> ${customer.address}</p>
                    <div class="result-stats">
                        <span><i class="fas fa-shopping-cart"></i> ${customer.totalPurchases || 0} purchases</span>
                        <span><i class="fas fa-rupee-sign"></i> ₹${(customer.totalAmount || 0).toFixed(2)} spent</span>
                        <span><i class="fas fa-calendar"></i> Last: ${customer.lastPurchase || 'Never'}</span>
                    </div>
                </div>
                <div class="result-card-footer">
                    <button class="btn btn-small view-result-btn" data-id="${id}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn btn-small add-purchase-result-btn" data-id="${id}">
                        <i class="fas fa-plus"></i> Add Purchase
                    </button>
                </div>
            `;
            
            resultsDiv.appendChild(customerCard);
        });
        
        // Add event listeners to result buttons
        document.querySelectorAll('.view-result-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const customerId = this.getAttribute('data-id');
                viewCustomerDetails(customerId);
            });
        });
        
        document.querySelectorAll('.add-purchase-result-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const customerId = this.getAttribute('data-id');
                document.getElementById('nav-add-purchase').click();
                document.getElementById('purchase-customer').value = customerId;
            });
        });
    }
    
    // Reports
    function setupReports() {
        const generateButton = document.getElementById('generate-report');
        const printButton = document.getElementById('print-report');
        
        generateButton.addEventListener('click', loadReports);
        printButton.addEventListener('click', function() {
            window.print();
        });
        
        // Set default dates
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        
        document.getElementById('report-from-date').value = firstDay.toISOString().split('T')[0];
        document.getElementById('report-to-date').value = today.toISOString().split('T')[0];
        document.getElementById('purchase-date').value = today.toISOString().split('T')[0];
    }
    
    function loadReports() {
        const fromDate = document.getElementById('report-from-date').value;
        const toDate = document.getElementById('report-to-date').value;
        
        // Calculate stats
        const allPurchases = Object.values(purchases);
        let filteredPurchases = allPurchases;
        
        if (fromDate || toDate) {
            filteredPurchases = allPurchases.filter(purchase => {
                const purchaseDate = purchase.purchaseDate || purchase.createdAt;
                return (!fromDate || purchaseDate >= fromDate) && 
                       (!toDate || purchaseDate <= toDate);
            });
        }
        
        const totalSales = filteredPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
        const totalPurchases = filteredPurchases.length;
        const avgPurchase = totalPurchases > 0 ? totalSales / totalPurchases : 0;
        
        // Get active customers (made at least one purchase in period)
        const activeCustomerIds = [...new Set(filteredPurchases.map(p => p.customerId))];
        
        // Update stats
        document.getElementById('report-total-sales').textContent = `₹${totalSales.toFixed(2)}`;
        document.getElementById('report-total-purchases').textContent = totalPurchases;
        document.getElementById('report-active-customers').textContent = activeCustomerIds.length;
        document.getElementById('report-avg-purchase').textContent = `₹${avgPurchase.toFixed(2)}`;
        
        // Top customers
        const customerTotals = {};
        filteredPurchases.forEach(purchase => {
            if (!customerTotals[purchase.customerId]) {
                customerTotals[purchase.customerId] = 0;
            }
            customerTotals[purchase.customerId] += purchase.totalAmount || 0;
        });
        
        const topCustomers = Object.keys(customerTotals)
            .map(id => ({
                id,
                name: customers[id]?.name || 'Unknown',
                total: customerTotals[id]
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
        
        const topList = document.getElementById('top-customers-list');
        if (topCustomers.length === 0) {
            topList.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-users"></i>
                    <p>No purchase data available for selected period</p>
                </div>
            `;
        } else {
            let html = '';
            topCustomers.forEach((customer, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                html += `
                    <div class="top-customer-item">
                        <div class="top-customer-rank">${medal}</div>
                        <div class="top-customer-info">
                            <h4>${customer.name}</h4>
                            <p>Total: ₹${customer.total.toFixed(2)}</p>
                        </div>
                        <button class="btn btn-small" onclick="viewCustomerDetails('${customer.id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </div>
                `;
            });
            topList.innerHTML = html;
        }
    }
    
    // Modal Events
    function setupModalEvents() {
        document.querySelector('.close-modal').addEventListener('click', closeModal);
        document.querySelector('.close-edit-modal').addEventListener('click', closeEditModal);
        document.getElementById('close-modal-btn').addEventListener('click', closeModal);
        
        document.getElementById('edit-customer-btn').addEventListener('click', function() {
            if (currentCustomerId) {
                editCustomer(currentCustomerId);
            }
        });
        
        document.getElementById('add-purchase-to-customer').addEventListener('click', function() {
            if (currentCustomerId) {
                closeModal();
                document.getElementById('nav-add-purchase').click();
                document.getElementById('purchase-customer').value = currentCustomerId;
            }
        });
    }
    
    // Customer Details Modal
    window.viewCustomerDetails = function(customerId) {
        currentCustomerId = customerId;
        const customer = customers[customerId];
        
        if (!customer) {
            alert('Customer not found');
            return;
        }
        
        // Get customer's purchases
        const customerPurchases = Object.values(purchases)
            .filter(p => p.customerId === customerId)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Update modal
        document.getElementById('modal-customer-name').textContent = customer.name;
        
        let infoHtml = `
            <div class="customer-modal-info">
                <div class="info-grid">
                    <div class="info-item">
                        <i class="fas fa-phone"></i>
                        <div>
                            <small>Phone</small>
                            <p>${customer.phone}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <div>
                            <small>Address</small>
                            <p>${customer.address}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-shopping-cart"></i>
                        <div>
                            <small>Total Purchases</small>
                            <p>${customer.totalPurchases || 0}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-rupee-sign"></i>
                        <div>
                            <small>Total Amount</small>
                            <p>₹${(customer.totalAmount || 0).toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <div>
                            <small>Last Purchase</small>
                            <p>${customer.lastPurchase || 'Never'}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-calendar-plus"></i>
                        <div>
                            <small>Customer Since</small>
                            <p>${new Date(customer.createdAt).toLocaleDateString('en-IN')}</p>
                        </div>
                    </div>
                </div>
                
                ${customer.notes && customer.notes !== 'No notes' ? `
                <div class="notes-section">
                    <h4><i class="fas fa-sticky-note"></i> Notes</h4>
                    <p>${customer.notes}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('modal-customer-info').innerHTML = infoHtml;
        
        // Purchase history
        let purchaseHtml = '';
        if (customerPurchases.length === 0) {
            purchaseHtml = '<p class="no-purchases">No purchase history yet.</p>';
        } else {
            customerPurchases.forEach(purchase => {
                const date = purchase.purchaseDate || purchase.createdAt;
                const formattedDate = new Date(date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
                
                purchaseHtml += `
                    <div class="purchase-history-item">
                        <div class="purchase-header">
                            <span class="purchase-date">${formattedDate}</span>
                            <span class="purchase-amount">₹${(purchase.totalAmount || 0).toFixed(2)}</span>
                        </div>
                        <div class="purchase-items">
                            ${(purchase.items || []).map(item => `
                                <div class="purchase-item-row">
                                    <span>${item.name}</span>
                                    <span>${item.quantity} × ₹${item.price.toFixed(2)}</span>
                                    <span>₹${item.total.toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                        ${purchase.paymentMode ? `
                        <div class="purchase-footer">
                            <span class="payment-mode">
                                <i class="fas fa-credit-card"></i> ${purchase.paymentMode}
                            </span>
                            ${purchase.notes && purchase.notes !== 'No notes' ? `
                            <span class="purchase-notes">
                                <i class="fas fa-comment"></i> ${purchase.notes}
                            </span>
                            ` : ''}
                        </div>
                        ` : ''}
                    </div>
                `;
            });
        }
        
        document.getElementById('modal-purchase-list').innerHTML = purchaseHtml;
        document.getElementById('customer-modal').style.display = 'flex';
    };
    
    // Edit Customer
    window.editCustomer = function(customerId) {
        const customer = customers[customerId];
        
        document.getElementById('edit-modal-title').textContent = `Edit Customer: ${customer.name}`;
        
        const editForm = document.createElement('form');
        editForm.id = 'edit-customer-modal-form';
        editForm.innerHTML = `
            <div class="form-group">
                <label for="edit-name">Customer Name *</label>
                <input type="text" id="edit-name" value="${customer.name}" required>
            </div>
            <div class="form-group">
                <label for="edit-phone">Phone Number *</label>
                <input type="tel" id="edit-phone" value="${customer.phone}" pattern="[0-9]{10}" required>
            </div>
            <div class="form-group">
                <label for="edit-address">Address</label>
                <input type="text" id="edit-address" value="${customer.address}">
            </div>
            <div class="form-group">
                <label for="edit-notes">Notes</label>
                <textarea id="edit-notes" rows="3">${customer.notes}</textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <button type="button" class="btn btn-secondary close-edit-modal">Cancel</button>
            </div>
        `;
        
        document.getElementById('edit-modal').querySelector('.modal-body').innerHTML = '';
        document.getElementById('edit-modal').querySelector('.modal-body').appendChild(editForm);
        document.getElementById('edit-modal').style.display = 'flex';
        
        // Handle form submission
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const updatedData = {
                name: document.getElementById('edit-name').value.trim(),
                phone: document.getElementById('edit-phone').value.trim(),
                address: document.getElementById('edit-address').value.trim(),
                notes: document.getElementById('edit-notes').value.trim(),
                updatedAt: new Date().toISOString()
            };
            
            try {
                if (database && auth && auth.currentUser) {
                    await database.ref('customers/' + customerId).update(updatedData);
                } else {
                    customers[customerId] = { ...customers[customerId], ...updatedData };
                    localStorage.setItem('store_customers', JSON.stringify(customers));
                }
                
                addActivity(`Updated customer: ${updatedData.name}`);
                alert('Customer updated successfully!');
                closeEditModal();
                loadCustomersTable();
                
                // Refresh current view if in customer modal
                if (document.getElementById('customer-modal').style.display === 'flex') {
                    viewCustomerDetails(customerId);
                }
                
            } catch (error) {
                console.error('Error updating customer:', error);
                alert('Error updating customer');
            }
        });
    };
    
    function closeModal() {
        document.getElementById('customer-modal').style.display = 'none';
        currentCustomerId = null;
    }
    
    function closeEditModal() {
        document.getElementById('edit-modal').style.display = 'none';
    }
    
    // Load customer options for purchase form
    function loadCustomerOptions() {
        const select = document.getElementById('purchase-customer');
        select.innerHTML = '<option value="">-- Select a customer --</option>';
        
        const sortedCustomers = Object.keys(customers)
            .map(id => ({ id, ...customers[id] }))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        sortedCustomers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = `${customer.name} (${customer.phone})`;
            select.appendChild(option);
        });
    }
    
    // Load customers table
    function loadCustomersTable() {
        const tbody = document.getElementById('customers-table-body');
        
        if (Object.keys(customers).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">
                        <i class="fas fa-users"></i>
                        <p>No customers found. Add your first customer!</p>
                    </td>
                </tr>
            `;
            
            // Update stats
            document.getElementById('total-customers-stat').textContent = '0';
            document.getElementById('active-customers-stat').textContent = '0';
            document.getElementById('avg-purchase-stat').textContent = '₹0';
            document.getElementById('table-info').textContent = 'Showing 0 customers';
            
            return;
        }
        
        // Convert to array and sort
        const customersArray = Object.keys(customers)
            .map(id => ({ id, ...customers[id] }))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        let html = '';
        customersArray.forEach((customer, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${customer.name}</td>
                    <td>${customer.phone}</td>
                    <td>${customer.totalPurchases || 0}</td>
                    <td>₹${(customer.totalAmount || 0).toFixed(2)}</td>
                    <td>${customer.lastPurchase || 'Never'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view-btn" onclick="viewCustomerDetails('${customer.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="action-btn edit-btn" onclick="editCustomer('${customer.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="action-btn delete-btn" onclick="deleteCustomer('${customer.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Update stats
        const totalCustomers = customersArray.length;
        const activeCustomers = customersArray.filter(c => (c.totalPurchases || 0) > 0).length;
        const totalAmount = customersArray.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
        const avgPurchase = activeCustomers > 0 ? totalAmount / activeCustomers : 0;
        
        document.getElementById('total-customers-stat').textContent = totalCustomers;
        document.getElementById('active-customers-stat').textContent = activeCustomers;
        document.getElementById('avg-purchase-stat').textContent = `₹${avgPurchase.toFixed(2)}`;
        document.getElementById('table-info').textContent = `Showing ${totalCustomers} customers`;
    }
    
    // Delete customer
    window.deleteCustomer = function(customerId) {
        const customer = customers[customerId];
        
        if (!customer) return;
        
        if (!confirm(`Are you sure you want to delete customer "${customer.name}"? This will also delete all their purchase records.`)) {
            return;
        }
        
        try {
            // Delete from Firebase if available
            if (database && auth && auth.currentUser) {
                database.ref('customers/' + customerId).remove();
                
                // Delete associated purchases
                Object.keys(purchases).forEach(purchaseId => {
                    if (purchases[purchaseId].customerId === customerId) {
                        database.ref('purchases/' + purchaseId).remove();
                    }
                });
            } else {
                // Delete from local storage
                delete customers[customerId];
                localStorage.setItem('store_customers', JSON.stringify(customers));
                
                // Delete associated purchases
                Object.keys(purchases).forEach(purchaseId => {
                    if (purchases[purchaseId].customerId === customerId) {
                        delete purchases[purchaseId];
                    }
                });
                localStorage.setItem('store_purchases', JSON.stringify(purchases));
            }
            
            addActivity(`Deleted customer: ${customer.name}`);
            alert('Customer deleted successfully!');
            
            // Refresh
            loadCustomersTable();
            updateCustomerStats();
            loadCustomerOptions();
            
        } catch (error) {
            console.error('Error deleting customer:', error);
            alert('Error deleting customer');
        }
    };
    
    // Load data
    function loadData() {
        // Try to load from Firebase first
        if (database && auth && auth.currentUser) {
            loadDataFromFirebase();
        } else {
            loadDataFromLocalStorage();
        }
    }
    
    function loadDataFromFirebase() {
        // Load customers
        database.ref('customers').on('value', (snapshot) => {
            customers = snapshot.val() || {};
            updateCustomerStats();
            addActivity(`Loaded ${Object.keys(customers).length} customers from Firebase`);
            
            // Refresh views if needed
            if (document.getElementById('view-customers-section').classList.contains('active')) {
                loadCustomersTable();
            }
            if (document.getElementById('add-purchase-section').classList.contains('active')) {
                loadCustomerOptions();
            }
        });
        
        // Load purchases
        database.ref('purchases').on('value', (snapshot) => {
            purchases = snapshot.val() || {};
            addActivity(`Loaded ${Object.keys(purchases).length} purchases from Firebase`);
        });
    }
    
    function loadDataFromLocalStorage() {
        // Load from localStorage
        customers = JSON.parse(localStorage.getItem('store_customers')) || {};
        purchases = JSON.parse(localStorage.getItem('store_purchases')) || {};
        
        updateCustomerStats();
        addActivity(`Loaded ${Object.keys(customers).length} customers from local storage`);
        
        // Refresh views
        if (document.getElementById('view-customers-section').classList.contains('active')) {
            loadCustomersTable();
        }
        if (document.getElementById('add-purchase-section').classList.contains('active')) {
            loadCustomerOptions();
        }
    }
    
    // Update customer stats in header
    function updateCustomerStats() {
        const customerCount = Object.keys(customers).length;
        const totalSales = Object.values(customers).reduce((sum, c) => sum + (c.totalAmount || 0), 0);
        
        document.getElementById('customer-count').textContent = customerCount;
        document.getElementById('total-sales').textContent = `₹${totalSales.toFixed(2)}`;
    }
    
    // Utility functions
    function showMessage(elementId, message, type) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.textContent = message;
        element.className = `form-message ${type}`;
        element.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }
    
    function addActivity(text) {
        const list = document.getElementById('recent-activity-list');
        if (!list) return;
        
        const now = new Date();
        const time = now.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        
        const li = document.createElement('li');
        li.textContent = `${time}: ${text}`;
        list.insertBefore(li, list.firstChild);
        
        // Keep only last 15 activities
        if (list.children.length > 15) {
            list.removeChild(list.lastChild);
        }
    }
    
    function updateDateTime() {
        const now = new Date();
        
        // Date
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('current-date').textContent = 
            now.toLocaleDateString('en-IN', dateOptions);
        
        // Time
        const timeOptions = { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        };
        document.getElementById('current-time').textContent = 
            now.toLocaleTimeString('en-IN', timeOptions);
    }
    
    // Refresh customers button
    document.getElementById('refresh-customers').addEventListener('click', function() {
        loadData();
        loadCustomersTable();
        addActivity('Refreshed customer list');
    });
    
    // Export customers button
    document.getElementById('export-customers').addEventListener('click', function() {
        exportCustomersToCSV();
    });
    
    function exportCustomersToCSV() {
        const customersArray = Object.keys(customers).map(id => ({
            'Customer Name': customers[id].name,
            'Phone': customers[id].phone,
            'Address': customers[id].address,
            'Total Purchases': customers[id].totalPurchases || 0,
            'Total Amount': customers[id].totalAmount || 0,
            'Last Purchase': customers[id].lastPurchase || 'Never',
            'Notes': customers[id].notes
        }));
        
        if (customersArray.length === 0) {
            alert('No customers to export');
            return;
        }
        
        // Convert to CSV
        const headers = Object.keys(customersArray[0]);
        const csvContent = [
            headers.join(','),
            ...customersArray.map(row => 
                headers.map(header => 
                    `"${String(row[header] || '').replace(/"/g, '""')}"`
                ).join(',')
            )
        ].join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `shree-balaji-customers-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addActivity('Exported customers to CSV');
    }
});

// Make functions available globally
window.viewCustomerDetails = viewCustomerDetails;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;