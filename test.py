#!/usr/bin/env python3
"""
Script de test complet pour l'application Budget Tracker
Simule un parcours utilisateur complet avec création de transactions
"""

import requests
import json
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import time

class BudgetTrackerTester:
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.session = requests.Session()
        self.user_data = {}
        self.categories = {}
        self.transactions = []
        self.auth_token = None
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, expected_status: int = 200, include_auth: bool = True) -> Optional[Dict]:
        """Effectue une requête HTTP avec gestion d'erreurs et authentification"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Ajouter l'authentification si disponible et demandée
        if include_auth and self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Méthode HTTP non supportée: {method}")
            
            self.log(f"{method} {endpoint} -> {response.status_code}")
            
            if response.status_code != expected_status:
                self.log(f"Erreur: Code de statut attendu {expected_status}, reçu {response.status_code}", "ERROR")
                self.log(f"Réponse: {response.text}", "ERROR")
                return None
                
            return response.json() if response.content else {}
            
        except requests.RequestException as e:
            self.log(f"Erreur de requête: {e}", "ERROR")
            return None
        except json.JSONDecodeError as e:
            self.log(f"Erreur de décodage JSON: {e}", "ERROR")
            return None

    def test_create_user(self, email: str = "autobot@google.com", password: str = "password123", firstName: str = "autobob") -> bool:
        """Test de création d'utilisateur"""
        self.log("=== TEST CRÉATION D'UTILISATEUR ===")
        
        user_data = {
            "email": email,
            "password": password,
            "firstName": firstName
        }
        
        response = self.make_request("POST", "/api/auth/register", user_data, 201, include_auth=False)
        
        if response and "user" in response:
            self.log(f"Utilisateur créé avec succès: {response['user']['firstName']} ({response['user']['email']})")
            return True
        elif response and "error" in response:
            # L'utilisateur existe peut-être déjà
            if "existe déjà" in response["error"] or "already exists" in response["error"]:
                self.log(f"Utilisateur existe déjà: {email}")
                return True
            else:
                self.log(f"Erreur création utilisateur: {response['error']}", "ERROR")
                return False
        else:
            self.log("Échec de création de l'utilisateur", "ERROR")
            return False

    def test_login(self, email: str = "autobot@google.com", password: str = "password123") -> bool:
        """Test de connexion utilisateur"""
        self.log("=== TEST DE CONNEXION ===")
        
        login_data = {
            "email": email,
            "password": password
        }
        
        response = self.make_request("POST", "/api/auth/login", login_data, include_auth=False)
        
        if response and "user" in response and "token" in response:
            self.user_data = response["user"]
            self.auth_token = response["token"]
            self.log(f"Connexion réussie: {self.user_data['firstName']} ({self.user_data['email']})")
            self.log(f"Token JWT récupéré: {self.auth_token[:20]}...")
            return True
        else:
            self.log("Échec de la connexion", "ERROR")
            return False

    def test_get_categories(self) -> bool:
        """Test de récupération des catégories"""
        self.log("=== TEST RÉCUPÉRATION DES CATÉGORIES ===")
        
        response = self.make_request("GET", "/api/categories")
        
        if response and "categories" in response:
            self.categories = {cat["type"]: [] for cat in response["categories"]}
            
            for category in response["categories"]:
                self.categories[category["type"]].append(category)
                
            self.log(f"Catégories récupérées:")
            for cat_type, cats in self.categories.items():
                self.log(f"  {cat_type}: {len(cats)} catégorie(s)")
                for cat in cats:
                    self.log(f"    - {cat['name']} (budget: {cat['budget_amount']}€)")
            
            return True
        else:
            self.log("Échec de récupération des catégories", "ERROR")
            return False

    def generate_realistic_transactions(self) -> List[Dict]:
        """Génère des transactions réalistes pour les 3 derniers mois"""
        transactions = []
        
        # Définir la période (3 derniers mois)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)
        
        # Templates de transactions par catégorie
        transaction_templates = {
            "fixed_expense": {
                "Logement": [
                    {"description": "Loyer mensuel", "amount_range": (800, 850), "frequency": "monthly"},
                    {"description": "Charges copropriété", "amount_range": (50, 80), "frequency": "monthly"}
                ],
                "Crédit Auto": [
                    {"description": "Mensualité crédit auto", "amount_range": (320, 350), "frequency": "monthly"}
                ],
                "Assurance Auto": [
                    {"description": "Assurance véhicule", "amount_range": (95, 105), "frequency": "monthly"}
                ],
                "Téléphone/Internet": [
                    {"description": "Forfait mobile", "amount_range": (25, 35), "frequency": "monthly"},
                    {"description": "Internet/Box", "amount_range": (35, 45), "frequency": "monthly"}
                ]
            },
            "variable_expense": {
                "Alimentation": [
                    {"description": "Courses Carrefour", "amount_range": (45, 85), "frequency": "weekly"},
                    {"description": "Courses Lidl", "amount_range": (25, 55), "frequency": "weekly"},
                    {"description": "Boulangerie", "amount_range": (8, 15), "frequency": "frequent"},
                    {"description": "Restaurant", "amount_range": (25, 60), "frequency": "occasional"}
                ],
                "Transport": [
                    {"description": "Essence", "amount_range": (50, 80), "frequency": "bi-weekly"},
                    {"description": "Péage autoroute", "amount_range": (15, 25), "frequency": "occasional"},
                    {"description": "Parking", "amount_range": (2, 8), "frequency": "frequent"}
                ],
                "Loisirs": [
                    {"description": "Cinéma", "amount_range": (12, 18), "frequency": "occasional"},
                    {"description": "Restaurant", "amount_range": (35, 75), "frequency": "occasional"},
                    {"description": "Streaming Netflix", "amount_range": (12, 15), "frequency": "monthly"},
                    {"description": "Sport/Gym", "amount_range": (25, 45), "frequency": "monthly"},
                    {"description": "Sorties/Bars", "amount_range": (20, 50), "frequency": "occasional"}
                ],
                "Santé": [
                    {"description": "Pharmacie", "amount_range": (15, 35), "frequency": "occasional"},
                    {"description": "Médecin généraliste", "amount_range": (25, 30), "frequency": "rare"},
                    {"description": "Dentiste", "amount_range": (50, 80), "frequency": "rare"}
                ],
                "Vêtements": [
                    {"description": "H&M", "amount_range": (25, 65), "frequency": "rare"},
                    {"description": "Chaussures", "amount_range": (40, 120), "frequency": "rare"},
                    {"description": "Sous-vêtements", "amount_range": (15, 35), "frequency": "rare"}
                ]
            },
            "income": {
                "Salaire": [
                    {"description": "Salaire mensuel", "amount_range": (2750, 2750), "frequency": "monthly"}
                ],
                "Primes": [
                    {"description": "Prime performance", "amount_range": (200, 500), "frequency": "rare"}
                ]
            },
            "savings": {
                "Épargne Mensuelle": [
                    {"description": "Virement épargne", "amount_range": (800, 800), "frequency": "monthly"}
                ]
            }
        }
        
        # Générer les transactions
        current_date = start_date
        while current_date <= end_date:
            # Pour chaque type de catégorie
            for cat_type, categories in transaction_templates.items():
                if cat_type not in self.categories:
                    continue
                    
                # Pour chaque catégorie disponible
                for category in self.categories[cat_type]:
                    cat_name = category["name"]
                    
                    if cat_name not in categories:
                        continue
                        
                    for template in categories[cat_name]:
                        should_create = False
                        
                        # Déterminer si on doit créer une transaction selon la fréquence
                        if template["frequency"] == "monthly":
                            should_create = current_date.day == 1 or (current_date.day <= 5 and random.random() < 0.3)
                        elif template["frequency"] == "bi-weekly":
                            should_create = current_date.day in [1, 15] or random.random() < 0.1
                        elif template["frequency"] == "weekly":
                            should_create = current_date.weekday() in [5, 6] and random.random() < 0.4
                        elif template["frequency"] == "frequent":
                            should_create = random.random() < 0.2
                        elif template["frequency"] == "occasional":
                            should_create = random.random() < 0.1
                        elif template["frequency"] == "rare":
                            should_create = random.random() < 0.05
                        
                        if should_create:
                            amount = random.randint(
                                int(template["amount_range"][0]),
                                int(template["amount_range"][1])
                            )
                            
                            # Ajuster la date légèrement pour plus de réalisme
                            transaction_date = current_date + timedelta(
                                hours=random.randint(8, 20),
                                minutes=random.randint(0, 59)
                            )
                            
                            transactions.append({
                                "category_id": category["id"],
                                "amount": amount,
                                "description": template["description"],
                                "transaction_date": transaction_date.strftime("%Y-%m-%d"),
                                "category_name": cat_name,
                                "category_type": cat_type
                            })
            
            current_date += timedelta(days=1)
        
        # Trier par date
        transactions.sort(key=lambda x: x["transaction_date"])
        
        self.log(f"Généré {len(transactions)} transactions sur 3 mois")
        return transactions

    def test_create_transactions(self) -> bool:
        """Test de création de transactions réalistes"""
        self.log("=== TEST CRÉATION DE TRANSACTIONS ===")
        
        transactions_to_create = self.generate_realistic_transactions()
        
        success_count = 0
        total_count = len(transactions_to_create)
        
        for i, transaction in enumerate(transactions_to_create):
            # Données à envoyer à l'API
            api_data = {
                "category_id": transaction["category_id"],
                "amount": transaction["amount"],
                "description": transaction["description"],
                "transaction_date": transaction["transaction_date"]
            }
            
            response = self.make_request("POST", "/api/transactions", api_data, 201)
            
            if response:
                success_count += 1
                self.log(f"Transaction créée ({i+1}/{total_count}): {transaction['description']} - {transaction['amount']}€")
                self.transactions.append(response)
            else:
                self.log(f"Échec création transaction ({i+1}/{total_count}): {transaction['description']}", "ERROR")
            
            # Petite pause pour éviter de surcharger le serveur
            if i % 10 == 0:
                time.sleep(0.5)
        
        self.log(f"Transactions créées: {success_count}/{total_count}")
        return success_count > 0

    def test_get_monthly_transactions(self) -> bool:
        """Test de récupération des transactions mensuelles"""
        self.log("=== TEST RÉCUPÉRATION TRANSACTIONS MENSUELLES ===")
        
        # Tester pour les 3 derniers mois
        now = datetime.now()
        months_to_test = [
            (now.month, now.year),
            ((now.month - 1) if now.month > 1 else 12, now.year if now.month > 1 else now.year - 1),
            ((now.month - 2) if now.month > 2 else 12 + (now.month - 2), now.year if now.month > 2 else now.year - 1)
        ]
        
        success = True
        
        for month, year in months_to_test:
            response = self.make_request("GET", f"/api/transactions/{month}/{year}")
            
            if response and "transactions" in response:
                transactions = response["transactions"]
                self.log(f"Mois {month}/{year}: {len(transactions)} transaction(s)")
                
                # Afficher un résumé par catégorie
                category_summary = {}
                total_amount = 0
                
                for transaction in transactions:
                    cat_name = transaction.get("category_name", "Inconnue")
                    cat_type = transaction.get("category_type", "unknown")
                    amount = transaction.get("amount", 0)
                    
                    if cat_name not in category_summary:
                        category_summary[cat_name] = {"count": 0, "total": 0, "type": cat_type}
                    
                    category_summary[cat_name]["count"] += 1
                    category_summary[cat_name]["total"] += amount
                    total_amount += amount if cat_type != "income" else -amount
                
                self.log(f"  Résumé par catégorie:")
                for cat_name, summary in category_summary.items():
                    self.log(f"    {cat_name}: {summary['count']} transactions, {summary['total']}€")
                
                self.log(f"  Dépenses nettes du mois: {total_amount}€")
                
            else:
                self.log(f"Échec récupération transactions {month}/{year}", "ERROR")
                success = False
        
        return success

    def test_transaction_operations(self) -> bool:
        """Test des opérations sur les transactions (modification/suppression)"""
        self.log("=== TEST OPÉRATIONS SUR TRANSACTIONS ===")
        
        if not self.transactions:
            self.log("Aucune transaction disponible pour les tests", "ERROR")
            return False
        
        # Prendre une transaction au hasard
        transaction = random.choice(self.transactions)
        transaction_id = transaction.get("id")
        
        if not transaction_id:
            self.log("ID de transaction non trouvé", "ERROR")
            return False
        
        # Test de modification
        modified_data = {
            "amount": transaction.get("amount", 0) + 10,
            "description": f"MODIFIÉE - {transaction.get('description', '')}",
            "category_id": transaction.get("category_id"),
            "transaction_date": transaction.get("transaction_date")
        }
        
        response = self.make_request("PUT", f"/api/transactions/{transaction_id}", modified_data)
        
        if response:
            self.log(f"Transaction {transaction_id} modifiée avec succès")
        else:
            self.log(f"Échec modification transaction {transaction_id}", "ERROR")
            return False
        
        # Test de suppression
        response = self.make_request("DELETE", f"/api/transactions/{transaction_id}", expected_status=204)
        
        if response is not None:  # 204 peut retourner None
            self.log(f"Transaction {transaction_id} supprimée avec succès")
            return True
        else:
            self.log(f"Échec suppression transaction {transaction_id}", "ERROR")
            return False

    def test_budget_analysis(self) -> bool:
        """Test d'analyse budgétaire"""
        self.log("=== TEST ANALYSE BUDGÉTAIRE ===")
        
        # Calculer les statistiques à partir des données récupérées
        now = datetime.now()
        
        response = self.make_request("GET", f"/api/transactions/{now.month}/{now.year}")
        
        if not response or "transactions" not in response:
            self.log("Impossible de récupérer les données pour l'analyse", "ERROR")
            return False
        
        transactions = response["transactions"]
        
        # Analyser par type de catégorie
        analysis = {
            "income": {"total": 0, "count": 0, "transactions": []},
            "fixed_expense": {"total": 0, "count": 0, "transactions": []},
            "variable_expense": {"total": 0, "count": 0, "transactions": []},
            "savings": {"total": 0, "count": 0, "transactions": []}
        }
        
        for transaction in transactions:
            cat_type = transaction.get("category_type", "unknown")
            amount = transaction.get("amount", 0)
            
            if cat_type in analysis:
                analysis[cat_type]["total"] += amount
                analysis[cat_type]["count"] += 1
                analysis[cat_type]["transactions"].append(transaction)
        
        # Afficher l'analyse
        self.log("Analyse budgétaire du mois courant:")
        
        total_income = analysis["income"]["total"]
        total_expenses = analysis["fixed_expense"]["total"] + analysis["variable_expense"]["total"]
        total_savings = analysis["savings"]["total"]
        remaining_budget = total_income - total_expenses - total_savings
        
        self.log(f"  Revenus: {total_income}€ ({analysis['income']['count']} transactions)")
        self.log(f"  Dépenses fixes: {analysis['fixed_expense']['total']}€ ({analysis['fixed_expense']['count']} transactions)")
        self.log(f"  Dépenses variables: {analysis['variable_expense']['total']}€ ({analysis['variable_expense']['count']} transactions)")
        self.log(f"  Épargne: {total_savings}€ ({analysis['savings']['count']} transactions)")
        self.log(f"  Reste à disposition: {remaining_budget}€")
        
        # Calcul des pourcentages
        if total_income > 0:
            self.log(f"  % Dépenses fixes: {(analysis['fixed_expense']['total'] / total_income * 100):.1f}%")
            self.log(f"  % Dépenses variables: {(analysis['variable_expense']['total'] / total_income * 100):.1f}%")
            self.log(f"  % Épargne: {(total_savings / total_income * 100):.1f}%")
        
        return True

    def run_complete_test(self) -> bool:
        """Exécute la suite complète de tests"""
        self.log("="*50)
        self.log("DÉBUT DES TESTS COMPLETS BUDGET TRACKER")
        self.log("="*50)
        
        tests = [
            ("Création d'utilisateur", self.test_create_user),
            ("Connexion utilisateur", self.test_login),
            ("Récupération catégories", self.test_get_categories),
            ("Création transactions", self.test_create_transactions),
            ("Récupération transactions mensuelles", self.test_get_monthly_transactions),
            ("Opérations sur transactions", self.test_transaction_operations),
            ("Analyse budgétaire", self.test_budget_analysis)
        ]
        
        results = {}
        failed_tests = []
        error_details = {}
        
        for test_name, test_func in tests:
            self.log(f"\n--- Début: {test_name} ---")
            try:
                results[test_name] = test_func()
                status = "RÉUSSI" if results[test_name] else "ÉCHEC"
                self.log(f"--- Fin: {test_name} - {status} ---")
                
                # Si le test échoue, noter les détails
                if not results[test_name]:
                    failed_tests.append(test_name)
                    
                    # Ajouter des détails spécifiques selon le type d'échec
                    if test_name == "Création d'utilisateur":
                        error_details[test_name] = "Impossible de créer l'utilisateur de test. Vérifiez l'endpoint /api/auth/register."
                    elif test_name == "Connexion utilisateur":
                        error_details[test_name] = "Échec de connexion. Vérifiez que l'utilisateur existe et que les identifiants sont corrects."
                    elif test_name == "Récupération catégories":
                        if not hasattr(self, 'auth_token') or not self.auth_token:
                            error_details[test_name] = "Pas de token d'authentification. La connexion a probablement échoué."
                        else:
                            error_details[test_name] = "Impossible de récupérer les catégories. Vérifiez l'endpoint /api/categories."
                    elif test_name == "Création transactions":
                        if not self.categories:
                            error_details[test_name] = "Aucune catégorie disponible pour créer des transactions."
                        else:
                            error_details[test_name] = "Échec de création des transactions. Vérifiez l'endpoint /api/transactions."
                    elif test_name == "Récupération transactions mensuelles":
                        error_details[test_name] = "Impossible de récupérer les transactions mensuelles. Vérifiez l'endpoint /api/transactions/{month}/{year}."
                    elif test_name == "Opérations sur transactions":
                        error_details[test_name] = "Impossible de modifier/supprimer les transactions. Vérifiez les endpoints PUT/DELETE."
                    elif test_name == "Analyse budgétaire":
                        error_details[test_name] = "Échec de l'analyse budgétaire. Probablement lié à l'absence de transactions."
                    
                    # Arrêter les tests si la connexion échoue (les autres tests dépendent de l'auth)
                    if test_name == "Connexion utilisateur":
                        self.log("\n❌ ARRÊT DES TESTS: La connexion utilisateur a échoué", "ERROR")
                        self.log("   Les tests suivants nécessitent une authentification valide", "ERROR")
                        break
                        
            except Exception as e:
                self.log(f"Erreur lors du test {test_name}: {e}", "ERROR")
                results[test_name] = False
                failed_tests.append(test_name)
                error_details[test_name] = f"Exception: {str(e)}"
        
        # Résumé final détaillé
        self.log("\n" + "="*50)
        self.log("RÉSUMÉ DÉTAILLÉ DES TESTS")
        self.log("="*50)
        
        total_tests = len([name for name, _ in tests])
        passed_tests = sum(1 for result in results.values() if result)
        
        # Tests réussis
        if passed_tests > 0:
            self.log("\n✅ TESTS RÉUSSIS:")
            for test_name, result in results.items():
                if result:
                    self.log(f"   ✅ {test_name}")
        
        # Tests échoués avec détails
        if failed_tests:
            self.log(f"\n❌ TESTS ÉCHOUÉS ({len(failed_tests)} sur {total_tests}):")
            for test_name in failed_tests:
                self.log(f"   ❌ {test_name}")
                if test_name in error_details:
                    self.log(f"      → {error_details[test_name]}")
        
        # Statistiques finales
        self.log(f"\n📊 STATISTIQUES:")
        self.log(f"   Total des tests: {total_tests}")
        self.log(f"   Tests réussis: {passed_tests}")
        self.log(f"   Tests échoués: {len(failed_tests)}")
        self.log(f"   Taux de réussite: {(passed_tests/total_tests*100):.1f}%")
        
        # Recommandations si des tests échouent
        if failed_tests:
            self.log(f"\n🔧 RECOMMANDATIONS POUR CORRIGER LES ÉCHECS:")
            
            if "Création d'utilisateur" in failed_tests:
                self.log("   1. Vérifiez que l'endpoint POST /api/auth/register fonctionne")
                self.log("   2. Vérifiez la structure des données attendues pour l'inscription")
            
            if "Connexion utilisateur" in failed_tests:
                self.log("   1. Assurez-vous que l'utilisateur autobot@google.com existe dans la base")
                self.log("   2. Vérifiez que le mot de passe est 'password123'")
                self.log("   3. Vérifiez l'endpoint POST /api/auth/login")
                self.log("   4. Vérifiez que la réponse contient un token JWT")
            
            if any(test in failed_tests for test in ["Récupération catégories", "Création transactions", "Récupération transactions mensuelles"]):
                self.log("   1. Vérifiez que l'authentification JWT fonctionne correctement")
                self.log("   2. Vérifiez que l'header 'Authorization: Bearer <token>' est accepté")
                self.log("   3. Exécutez le script init.ts pour créer les catégories par défaut")
        
        self.log("\n" + "="*50)
        
        if passed_tests == total_tests:
            self.log("🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS!")
            return True
        else:
            self.log(f"⚠️ {len(failed_tests)} TEST(S) ONT ÉCHOUÉ - VOIR DÉTAILS CI-DESSUS")
            return False

def main():
    """Fonction principale"""
    print("Script de test Budget Tracker")
    print("Assurez-vous que votre serveur est démarré sur http://localhost:3001")
    
    # Demander confirmation
    response = input("\nAppuyer sur Entrée pour commencer les tests (ou 'q' pour quitter): ")
    if response.lower() == 'q':
        print("Tests annulés")
        return
    
    # Créer et lancer le testeur
    tester = BudgetTrackerTester()
    success = tester.run_complete_test()
    
    if success:
        print("\n🎉 Tests terminés avec succès!")
    else:
        print("\n⚠️ Tests terminés avec des erreurs")

if __name__ == "__main__":
    main()