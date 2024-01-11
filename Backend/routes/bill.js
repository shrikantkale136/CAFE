const express = require("express");
const connection = require("../connection");
const auth = require("../services/auth");
const ejs = require("ejs");
const pdf = require("html-pdf");
const path = require("path");
const fs = require("fs");
const uuid = require("uuid");

const router = express.Router();

router.post("/generateReport", auth.authenticate, (req, res) => {
  const orderDetails = req.body;
  const generatedUUID = uuid.v1();
  let productDetailsReport = JSON.parse(orderDetails.productDetails);

  let query =
    "insert into bill (name, uuid, email, contactNumber, paymentMethod, total, productDetails, createdBy) values(?,?,?,?,?,?,?,?)";

  connection.query(
    query,
    [
      orderDetails.name,
      generatedUUID,
      orderDetails.email,
      orderDetails.contactNumber,
      orderDetails.paymentMethod,
      orderDetails.totalAmount,
      orderDetails.productDetails,
      res.locals.email,
    ],
    (err, results) => {
      if (!err) {
        // Update product quantities after successful bill insertion
        updateProductQuantities(productDetailsReport);

        ejs.renderFile(
          path.join(__dirname, "", "report.ejs"),
          {
            productDetails: productDetailsReport,
            name: orderDetails.name,
            email: orderDetails.email,
            contactNumber: orderDetails.contactNumber,
            paymentMethod: orderDetails.paymentMethod,
            totalAmount: orderDetails.totalAmount,
          },
          (err, results) => {
            if (err) {
              return res.status(500).json({ err });
            } else {
              pdf
                .create(results)
                .toFile(
                  "../generated_PDF/" + generatedUUID + ".pdf",
                  (err, data) => {
                    if (err) {
                      console.log(err);
                      return res.status(500).json({ err });
                    } else {
                      return res.status(200).json({ uuid: generatedUUID });
                    }
                  }
                );
            }
          }
        );
      } else {
        return res.status(500).json({ err });
      }
    }
  );
});

// Function to update product quantities in the product table
function updateProductQuantities(productDetailsReport) {
  productDetailsReport.forEach((product) => {
    const updateQuery =
      "UPDATE product SET quantity = quantity - ? WHERE id = ?";

    connection.query(
      updateQuery,
      [product.quantity, product.id],
      (updateErr, updateResults) => {
        if (updateErr) {
          console.error("Update Error:", updateErr);
        }
      }
    );
  });
}

router.post("/addTobackOrder", (req, res) => {
  const backOrderDetailsArray = req.body;
  const generatedUUIDs = Array.from(
    { length: backOrderDetailsArray.length },
    () => uuid.v1()
  );

  console.log("backOrderDetailsArray", backOrderDetailsArray);

  const query = "SELECT id, quantity FROM backorder WHERE productID = ?";
  const insertQuery =
    "INSERT INTO backorder (id, productID, quantity, status) VALUES (?, ?, ?, ?)";

  const values = backOrderDetailsArray.map((backOrderDetails, index) => [
    generatedUUIDs[index],
    backOrderDetails.product_id,
    backOrderDetails.quantity,
    backOrderDetails.status,
  ]);

  values.forEach((params) => {
    connection.query(query, [params[1]], (err, results) => {
      if (err) {
        return res.status(500).json({ err });
      } else if (results.length > 0) {
        // If record exists, update quantity
        const updateQuery =
          "UPDATE backorder SET quantity = quantity + ? WHERE id = ?";
        connection.query(
          updateQuery,
          [params[2], results[0].id],
          (updateErr, updateResults) => {
            if (updateErr) {
              return res.status(500).json({ updateErr });
            }
          }
        );
      } else {
        // If record does not exist, insert a new record
        connection.query(insertQuery, params, (insertErr, insertResults) => {
          if (insertErr) {
            return res.status(500).json({ insertErr });
          }
        });
      }
    });
  });

  return res
    .status(200)
    .json({ message: "Products added to back Order successfully" });
});

router.post("/getPDF", auth.authenticate, (req, res) => {
  const orderDetails = req.body;
  const pdfPath = "../generated_PDF/" + orderDetails.uuid + ".pdf";
  if (fs.existsSync(pdfPath)) {
    res.contentType("application/pdf");
    fs.createReadStream(pdfPath).pipe(res);
  } else {
    let productDetailsReport = JSON.parse(orderDetails.productDetails);
    ejs.renderFile(
      path.join(__dirname, "", "report.ejs"),
      {
        productDetails: productDetailsReport,
        name: orderDetails.name,
        email: orderDetails.email,
        contactNumber: orderDetails.contactNumber,
        paymentMethod: orderDetails.paymentMethod,
        totalAmount: orderDetails.totalAmount,
      },
      (err, results) => {
        if (err) {
          return res.status(200).json({ err });
        } else {
          pdf
            .create(results)
            .toFile(
              "./generated_PDF/" + orderDetails.uuid + ".pdf",
              (err, data) => {
                if (err) {
                  console.log(err);
                  return res.status(500).json({ err });
                } else {
                  res.contentType("application/pdf");
                  fs.createReadStream(pdfPath).pipe(res);
                }
              }
            );
        }
      }
    );
  }
});

router.get("/getBills", auth.authenticate, (req, res, next) => {
  let query = "select * from bill order by id DESC";
  connection.query(query, (err, results) => {
    if (!err) {
      return res.status(200).json({ data: results });
    } else {
      return res.status(500).json({ err });
    }
  });
});

router.delete("/delete/:id", auth.authenticate, (req, res, next) => {
  const id = req.params.id;
  let query = "delete from bill where id=?";
  connection.query(query, [id], (err, results) => {
    if (!err) {
      if (results.affectedRows == 0) {
        return res.status(404).json({ message: "Bill ID not found" });
      }
      return res.status(200).json({ message: "Bill deleted successfully" });
    } else {
      return res.status(500).json({ err });
    }
  });
});

module.exports = router;
