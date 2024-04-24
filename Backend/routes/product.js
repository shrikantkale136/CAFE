const express = require("express");
const connection = require("../connection");
const auth = require("../services/auth");
const role = require("../services/checkRole");

const router = express.Router();

router.post("/add", auth.authenticate, role.checkRole, (req, res) => {
  let product = req.body;
  let query =
    'insert into product (name, categoryID, description, price, quantity, status) values(?,?,?,?,?,"true")';

  connection.query(
    query,
    [
      product.name,
      product.categoryID,
      product.description,
      product.price,
      product.quantity,
    ],
    (err, results) => {
      if (!err) {
        return res.status(200).json({ message: "Product added successfully" });
      } else {
        return res.status(500).json({ err });
      }
    }
  );
});

router.get("/checkBackOrder/:id", auth.authenticate, (req, res, next) => {
  let id = req.params.id;
  let query = "select quantity from backorder where productID=?";
  connection.query(query, [id], (err, results) => {
    if (!err) {
      return res.status(200).json({ data: results });
    } else {
      return res.status(500).json({ err });
    }
  });
});

router.get("/get", auth.authenticate, (req, res, next) => {
  let query =
    "select p.id, p.name, p.description, p.price, p.`quantity`, p.status, c.id as categoryID, c.name as categoryName from product as p INNER JOIN category as c where p.categoryID=c.id ";
  connection.query(query, (err, results) => {
    if (!err) {
      return res.status(200).json({ data: results });
    } else {
      return res.status(500).json({ err });
    }
  });
});

router.get("/getByCategoryID/:id", auth.authenticate, (req, res, next) => {
  const id = req.params.id;
  let query =
    'select id, name from product where categoryID=? and status="true"';
  connection.query(query, [id], (err, results) => {
    if (!err) {
      return res.status(200).json({ data: results });
    } else {
      return res.status(500).json({ err });
    }
  });
});

router.get("/getByID/:id", (req, res, next) => {
  const id = req.params.id;
  let query =
    "select id,name,description,price,quantity from product where id=?";
  connection.query(query, [id], (err, results) => {
    if (!err) {
      return res.status(200).json({ data: results[0] });
    } else {
      return res.status(500).json({ err });
    }
  });
});

router.patch("/update", auth.authenticate, role.checkRole, (req, res, next) => {
  let product = req.body;

  let checkBackOrderQuery = "SELECT quantity FROM backorder WHERE productID=?";
  let updateProductQuery =
    "UPDATE product SET name=?, categoryID=?, description=?, price=?, quantity=? WHERE id=?";
  let updateBackOrderQuery =
    "UPDATE backorder SET quantity = ?, status=? WHERE productID=? AND status='unfinished'";

  console.log("Received product data:", product);

  // Check if the productID exists in backorder table
  connection.query(
    checkBackOrderQuery,
    [product.id],
    (backOrderErr, backOrderResults) => {
      if (backOrderErr) {
        console.error("Back Order Check Error:", backOrderErr);
        return res.status(500).json({ err: backOrderErr });
      }

      connection.beginTransaction((transactionErr) => {
        if (transactionErr) {
          console.error("Transaction Begin Error:", transactionErr);
          return res.status(500).json({ err: transactionErr });
        }

        connection.query(
          updateProductQuery,
          [
            product.name,
            product.categoryID,
            product.description,
            product.price,
            product.quantity,
            product.id,
          ],
          (productErr, productResults) => {
            if (productErr) {
              console.error("Update Product Error:", productErr);
              connection.rollback(() => {
                return res.status(500).json({ err: productErr });
              });
            }

            if (backOrderResults.length > 0) {
              const newQuantity = Math.floor(
                0,
                backOrderResults[0].quantity - product.quantity
              );

              connection.query(
                updateBackOrderQuery,
                [
                  newQuantity,
                  newQuantity <= 0 ? "finished" : "unfinished",
                  product.id,
                ],
                (backOrderUpdateErr, backOrderUpdateResults) => {
                  if (backOrderUpdateErr) {
                    console.error(
                      "Update Back Order Error:",
                      backOrderUpdateErr
                    );
                    connection.rollback(() => {
                      return res.status(500).json({ err: backOrderUpdateErr });
                    });
                  }

                  // Commit
                  connection.commit((commitErr) => {
                    if (commitErr) {
                      console.error("Transaction Commit Error:", commitErr);
                      connection.rollback(() => {
                        return res.status(500).json({ err: commitErr });
                      });
                    }

                    return res
                      .status(200)
                      .json({ message: "Product updated successfully" });
                  });
                }
              );
            } else {
              // Commit the transaction if all queries succeed
              connection.commit((commitErr) => {
                if (commitErr) {
                  console.error("Transaction Commit Error:", commitErr);
                  connection.rollback(() => {
                    return res.status(500).json({ err: commitErr });
                  });
                }

                return res
                  .status(200)
                  .json({ message: "Product updated successfully" });
              });
            }
          }
        );
      });
    }
  );
});

router.patch("/update", auth.authenticate, role.checkRole, (req, res, next) => {
  let product = req.body;

  let checkBackOrderQuery = "SELECT quantity FROM backorder WHERE productID=?";
  let updateProductQuery =
    "UPDATE product SET name=?, categoryID=?, description=?, price=?, quantity=? WHERE id=?";
  let updateBackOrderQuery =
    "UPDATE backorder SET quantity = quantity - ?, status=? WHERE productID=? AND status='unfinished'";

  console.log("Received product data:", product);

  // Check if the productID exists in backorder table
  connection.query(
    checkBackOrderQuery,
    [product.id],
    (backOrderErr, backOrderResults) => {
      if (backOrderErr) {
        console.error("Back Order Check Error:", backOrderErr);
        return res.status(500).json({ err: backOrderErr });
      }

      connection.beginTransaction((transactionErr) => {
        if (transactionErr) {
          console.error("Transaction Begin Error:", transactionErr);
          return res.status(500).json({ err: transactionErr });
        }

        // Update product table
        connection.query(
          updateProductQuery,
          [
            product.name,
            product.categoryID,
            product.description,
            product.price,
            product.quantity,
            product.id,
          ],
          (productErr, productResults) => {
            if (productErr) {
              console.error("Update Product Error:", productErr);
              connection.rollback(() => {
                return res.status(500).json({ err: productErr });
              });
            }

            // Check if the productID exists in backorder and update backorder quantity and status
            if (backOrderResults.length > 0) {
              const newQuantity =
                backOrderResults[0].quantity - product.quantity;

              // Update backorder quantity and status if new quantity is 0 or less
              if (newQuantity <= 0) {
                connection.query(
                  updateBackOrderQuery,
                  [product.quantity, "complete", product.id],
                  (backOrderUpdateErr, backOrderUpdateResults) => {
                    if (backOrderUpdateErr) {
                      console.error(
                        "Update Back Order Error:",
                        backOrderUpdateErr
                      );
                      connection.rollback(() => {
                        return res
                          .status(500)
                          .json({ err: backOrderUpdateErr });
                      });
                    }

                    // Commit the transaction if all queries succeed
                    connection.commit((commitErr) => {
                      if (commitErr) {
                        console.error("Transaction Commit Error:", commitErr);
                        connection.rollback(() => {
                          return res.status(500).json({ err: commitErr });
                        });
                      }

                      return res
                        .status(200)
                        .json({ message: "Product updated successfully" });
                    });
                  }
                );
              } else {
                // Commit the transaction if all queries succeed
                connection.commit((commitErr) => {
                  if (commitErr) {
                    console.error("Transaction Commit Error:", commitErr);
                    connection.rollback(() => {
                      return res.status(500).json({ err: commitErr });
                    });
                  }

                  return res
                    .status(200)
                    .json({ message: "Product updated successfully" });
                });
              }
            } else {
              // Commit the transaction if all queries succeed
              connection.commit((commitErr) => {
                if (commitErr) {
                  console.error("Transaction Commit Error:", commitErr);
                  connection.rollback(() => {
                    return res.status(500).json({ err: commitErr });
                  });
                }

                return res
                  .status(200)
                  .json({ message: "Product updated successfully" });
              });
            }
          }
        );
      });
    }
  );
});

router.delete(
  "/delete/:id",
  auth.authenticate,
  role.checkRole,
  (req, res, next) => {
    const id = req.params.id;
    let query = "delete from product where id=?";
    connection.query(query, [id], (err, results) => {
      if (!err) {
        if (results.affectedRows == 0) {
          return res.status(404).json({ message: "Product ID not found" });
        }
        return res
          .status(200)
          .json({ message: "Product deleted successfully" });
      } else {
        return res.status(500).json({ err });
      }
    });
  }
);

router.patch(
  "/updateStatus",
  auth.authenticate,
  role.checkRole,
  (req, res, next) => {
    const product = req.body;
    let query = "update product set status=? where id=?";
    connection.query(query, [product.status, product.id], (err, results) => {
      if (!err) {
        if (results.affectedRows == 0) {
          return res.status(404).json({ message: "Product ID not found" });
        }
        return res
          .status(200)
          .json({ message: "Product status has been updated successfully" });
      } else {
        return res.status(500).json({ err });
      }
    });
  }
);

module.exports = router;
