// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IRegistry} from "../vendor/ens-v2/src/registry/interfaces/IRegistry.sol";
import {ArtRegistry} from "./ArtRegistry.sol";
interface IParent { function findExpiry(string calldata label) external view returns(uint64); }

/// Escrowed ETH listings. No admin or custody key; sellers can cancel and reclaim tokens.
contract ArtSale is ReentrancyGuard, IERC1155Receiver {
    struct Listing { address seller; uint256 tokenId; uint256 price; uint64 deadline; uint256 nonce; }
    ArtRegistry public immutable registry;
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256) public proceeds;
    mapping(uint256 => bool) public sold;
    uint256 private nextNonce;
    event Listed(uint256 indexed id, address seller, uint256 price, uint256 nonce);
    event Purchased(uint256 indexed id,address buyer,address seller,uint256 price,uint256 royalty);
    constructor(ArtRegistry registry_) { registry = registry_; }
    function _activeParent() private view {
        (IRegistry parent,string memory label)=registry.getParent();
        require(address(parent.getSubregistry(label))==address(registry),"Link parent ENS name first");
        require(IParent(address(parent)).findExpiry(label)>block.timestamp,"Parent expired");
    }
    function list(uint256 id,uint256 price,uint64 deadline) external nonReentrant {
        _activeParent();
        require(price>0 && deadline>block.timestamp,"Invalid listing");
        require(registry.getTokenId(id)==id && registry.ownerOf(id)==msg.sender,"Not current owner/token");
        require(listings[id].seller==address(0),"Already listed");
        registry.safeTransferFrom(msg.sender,address(this),id,1,"");
        listings[id]=Listing(msg.sender,id,price,deadline,++nextNonce);
        emit Listed(id,msg.sender,price,nextNonce);
    }
    function cancel(uint256 id) external nonReentrant {
        require(listings[id].seller==msg.sender,"Not seller");
        delete listings[id]; registry.safeTransferFrom(address(this),msg.sender,id,1,"");
    }
    function buy(uint256 id,uint256 expectedNonce) external payable nonReentrant {
        _activeParent(); Listing memory l = listings[id];
        require(l.seller!=address(0) && l.nonce==expectedNonce,"Stale listing");
        require(l.deadline>block.timestamp && registry.getExpiry(id)>block.timestamp,"Expired");
        require(registry.getTokenId(id)==id && registry.ownerOf(id)==address(this),"Stale token");
        require(msg.value==l.price,"Wrong payment");
        delete listings[id];
        (address recipient,uint256 royalty)=registry.royaltyInfo(id,msg.value);
        if (!sold[id & ~uint256(type(uint32).max)] && l.seller==registry.artist()) royalty=0;
        // Mark by canonical label, independently of mutable token version bits.
        uint256 key = id & ~uint256(type(uint32).max);
        if (sold[key]) (,royalty)=registry.royaltyInfo(id,msg.value);
        sold[key]=true;
        proceeds[recipient]+=royalty; proceeds[l.seller]+=msg.value-royalty;
        registry.safeTransferFrom(address(this),msg.sender,id,1,"");
        emit Purchased(id,msg.sender,l.seller,msg.value,royalty);
    }
    function withdraw() external nonReentrant {
        uint256 value=proceeds[msg.sender]; require(value>0,"No proceeds"); proceeds[msg.sender]=0;
        (bool ok,)=payable(msg.sender).call{value:value}(""); require(ok,"Withdrawal failed");
    }
    function onERC1155Received(address operator,address,uint256,uint256,bytes calldata) external view returns(bytes4) {
        require(msg.sender==address(registry) && operator==address(this),"Use list"); return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address,address,uint256[] calldata,uint256[] calldata,bytes calldata) external pure returns(bytes4) { revert("No batches"); }
    function supportsInterface(bytes4 id) external pure returns(bool) { return id==0x01ffc9a7 || id==0x4e2312e0; }
}
